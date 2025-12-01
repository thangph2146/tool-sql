"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { GitCompare, BarChart3 } from "lucide-react";
import type { DatabaseName } from "@/lib/db-config";
import { useTableData, useTableRelationships } from "@/lib/hooks/use-database-query";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import { useTableComparison } from "@/lib/hooks/use-table-comparison";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ComparisonTable } from "./comparison-table";
import { ComparisonLoadingState } from "./comparison-loading-state";
import { DEFAULT_TABLE_LIMIT } from "@/lib/constants/table-constants";
import { getColumnsToDisplay } from "@/lib/utils/table-column-utils";
import { sortRelationships } from "@/lib/utils/relationship-utils";
import { analyzeDataQuality } from "@/lib/utils/data-quality-utils";
import { useFlowLoggerWithKey } from "@/lib/hooks/use-flow-logger";
import { FLOW_NAMES } from "@/lib/constants/flow-constants";
import { useSyncedColumns } from "@/lib/hooks/use-synced-columns";
import { ColumnSelector, type CombinedColumn } from "./column-selector";
import { getColumnValue, validateCombinedColumns } from "@/lib/utils/combined-column-utils";

interface TableComparisonViewProps {
  leftTable: {
    databaseName: DatabaseName;
    schemaName: string;
    tableName: string;
  };
  rightTable: {
    databaseName: DatabaseName;
    schemaName: string;
    tableName: string;
  };
  onClose?: () => void;
  open?: boolean;
  asDialog?: boolean;
  onTableChange?: (database: DatabaseName, schema: string, table: string) => void;
}

export function TableComparisonView({
  leftTable,
  rightTable,
  onClose,
  open = true,
  asDialog = false,
  onTableChange,
}: TableComparisonViewProps) {
  const [leftLimit, setLeftLimit] = useState(DEFAULT_TABLE_LIMIT);
  const [rightLimit, setRightLimit] = useState(DEFAULT_TABLE_LIMIT);
  const [showLeftFilters, setShowLeftFilters] = useState(false);
  const [showRightFilters, setShowRightFilters] = useState(false);
  const [includeReferences, setIncludeReferences] = useState(true);
  const [combinedColumns, setCombinedColumns] = useState<CombinedColumn[]>([]);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);

  // Flow logging with key-based lifecycle (only when open)
  const comparisonKey = open
    ? `${leftTable.databaseName}_${leftTable.schemaName}_${leftTable.tableName}_VS_${rightTable.databaseName}_${rightTable.schemaName}_${rightTable.tableName}`
    : '';
  
  const { flowLog, end: endFlow } = useFlowLoggerWithKey(
    comparisonKey,
    () => FLOW_NAMES.TABLE_COMPARISON(
      leftTable.databaseName,
      leftTable.schemaName,
      leftTable.tableName,
      rightTable.databaseName,
      rightTable.schemaName,
      rightTable.tableName
    ),
    () => ({
      leftTable: {
        database: leftTable.databaseName,
        schema: leftTable.schemaName,
        table: leftTable.tableName,
      },
      rightTable: {
        database: rightTable.databaseName,
        schema: rightTable.schemaName,
        table: rightTable.tableName,
      },
      includeReferences,
      leftLimit,
      rightLimit,
    }),
    open
  );

  // Handle flow when open state changes
  useEffect(() => {
    if (!open && flowLog) {
      endFlow(true, {
        leftTable: `${leftTable.schemaName}.${leftTable.tableName}`,
        rightTable: `${rightTable.schemaName}.${rightTable.tableName}`,
        reason: 'Dialog/view closed',
      });
    }
  }, [open, flowLog, endFlow, leftTable.schemaName, leftTable.tableName, rightTable.schemaName, rightTable.tableName]);

  // Log when view opens
  useEffect(() => {
    if (flowLog && open) {
      flowLog.info('TableComparisonView opened', {
        leftTable: `${leftTable.schemaName}.${leftTable.tableName} (${leftTable.databaseName})`,
        rightTable: `${rightTable.schemaName}.${rightTable.tableName} (${rightTable.databaseName})`,
      });
    }
  }, [flowLog, open, leftTable, rightTable]);

  // Fetch relationships for both tables
  const leftRelationshipsData = useTableRelationships(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    open // Only fetch when dialog/view is open
  );

  const rightRelationshipsData = useTableRelationships(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    open // Only fetch when dialog/view is open
  );

  const leftRelationships = useMemo(() => {
    const rels = ((leftRelationshipsData?.data as { data?: { relationships?: unknown[] } })?.data?.relationships || []) as Array<{
      FK_NAME: string;
      FK_SCHEMA: string;
      FK_TABLE: string;
      FK_COLUMN: string;
      PK_SCHEMA: string;
      PK_TABLE: string;
      PK_COLUMN: string;
    }>;
    
    const sorted = sortRelationships(rels);
    
    if (flowLog) {
      flowLog.debug('Left relationships processed', {
        rawCount: rels.length,
        sortedCount: sorted.length,
        isLoading: leftRelationshipsData?.isLoading,
        hasError: !!leftRelationshipsData?.error,
        hasData: !!leftRelationshipsData?.data,
      });
    }
    
    return sorted;
  }, [leftRelationshipsData?.data, leftRelationshipsData?.isLoading, leftRelationshipsData?.error, flowLog]);

  const rightRelationships = useMemo(() => {
    const rels = ((rightRelationshipsData?.data as { data?: { relationships?: unknown[] } })?.data?.relationships || []) as Array<{
      FK_NAME: string;
      FK_SCHEMA: string;
      FK_TABLE: string;
      FK_COLUMN: string;
      PK_SCHEMA: string;
      PK_TABLE: string;
      PK_COLUMN: string;
    }>;
    
    const sorted = sortRelationships(rels);
    
    if (flowLog) {
      flowLog.debug('Right relationships processed', {
        rawCount: rels.length,
        sortedCount: sorted.length,
        isLoading: rightRelationshipsData?.isLoading,
        hasError: !!rightRelationshipsData?.error,
        hasData: !!rightRelationshipsData?.data,
      });
    }
    
    return sorted;
  }, [rightRelationshipsData?.data, rightRelationshipsData?.isLoading, rightRelationshipsData?.error, flowLog]);

  // Filter state hooks (debounced values used to request filtered data)
  const leftTableFilters = useTableFilters();
  const rightTableFilters = useTableFilters();

  // Fetch initial data for both tables (offset 0)
  const leftData = useTableData(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    leftLimit,
    0, // Start with offset 0
    open, // Only fetch when dialog/view is open
    includeReferences,
    leftTableFilters.debouncedFilters
  );

  const rightData = useTableData(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    rightLimit,
    0, // Start with offset 0
    open, // Only fetch when dialog/view is open
    includeReferences,
    rightTableFilters.debouncedFilters
  );

  // Get totalRows from initial data fetch (will be updated after data loads)
  const leftTableData = leftData?.data?.data;
  const rightTableData = rightData?.data?.data;
  const leftTotalRows = leftTableData?.totalRows ?? 0;
  const rightTotalRows = rightTableData?.totalRows ?? 0;

  // Pagination hooks for both tables
  const leftPagination = useTablePagination({
    totalRows: leftTotalRows,
    limit: leftLimit,
    onLimitChange: useCallback((newLimit: number) => {
      setLeftLimit(newLimit);
    }, []),
  });

  const rightPagination = useTablePagination({
    totalRows: rightTotalRows,
    limit: rightLimit,
    onLimitChange: useCallback((newLimit: number) => {
      setRightLimit(newLimit);
    }, []),
  });

  // Fetch paginated data when offset changes (only if offset > 0 to avoid duplicate call)
  const { data: leftPaginatedData, isLoading: isLeftPaginatedLoading, error: leftPaginatedError } = useTableData(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    leftLimit,
    leftPagination.offset,
    open && leftPagination.offset > 0, // Only fetch if offset > 0
    includeReferences,
    leftTableFilters.debouncedFilters
  );

  const { data: rightPaginatedData, isLoading: isRightPaginatedLoading, error: rightPaginatedError } = useTableData(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    rightLimit,
    rightPagination.offset,
    open && rightPagination.offset > 0, // Only fetch if offset > 0
    includeReferences,
    rightTableFilters.debouncedFilters
  );

  // Use paginated data if offset > 0, otherwise use initial data
  const finalLeftTableData = leftPagination.offset > 0 ? leftPaginatedData?.data : leftTableData;
  const finalRightTableData = rightPagination.offset > 0 ? rightPaginatedData?.data : rightTableData;
  const finalLeftIsLoading = leftPagination.offset > 0 ? isLeftPaginatedLoading : leftData.isLoading;
  const finalRightIsLoading = rightPagination.offset > 0 ? isRightPaginatedLoading : rightData.isLoading;
  const finalLeftError = leftPagination.offset > 0 ? leftPaginatedError : leftData.error;
  const finalRightError = rightPagination.offset > 0 ? rightPaginatedError : rightData.error;

  // Log when table data is loaded
  useEffect(() => {
    if (finalLeftTableData && finalRightTableData && flowLog) {
      flowLog.success('Comparison data loaded', {
        leftTable: {
          rowsLoaded: finalLeftTableData.rows.length,
          totalRows: finalLeftTableData.totalRows,
          columns: finalLeftTableData.columns.length,
        },
        rightTable: {
          rowsLoaded: finalRightTableData.rows.length,
          totalRows: finalRightTableData.totalRows,
          columns: finalRightTableData.columns.length,
        },
        leftOffset: leftPagination.offset,
        rightOffset: rightPagination.offset,
        leftLimit,
        rightLimit,
        includeReferences,
      });
    }
  }, [finalLeftTableData, finalRightTableData, leftPagination.offset, rightPagination.offset, leftLimit, rightLimit, includeReferences, flowLog]);

  // Log errors and loading states
  useEffect(() => {
    if (leftData.error && flowLog) {
      flowLog.error('Error loading left table data', leftData.error);
    }
    if (rightData.error && flowLog) {
      flowLog.error('Error loading right table data', rightData.error);
    }
    if (leftRelationshipsData?.error && flowLog) {
      flowLog.error('Error loading left relationships', leftRelationshipsData.error);
    }
    if (rightRelationshipsData?.error && flowLog) {
      flowLog.error('Error loading right relationships', rightRelationshipsData.error);
    }
    if (flowLog) {
      flowLog.debug('Data loading states', {
        leftLoading: leftData.isLoading,
        rightLoading: rightData.isLoading,
        leftRelationshipsLoading: leftRelationshipsData?.isLoading,
        rightRelationshipsLoading: rightRelationshipsData?.isLoading,
        leftError: leftData.error ? (leftData.error instanceof Error ? leftData.error.message : String(leftData.error)) : null,
        rightError: rightData.error ? (rightData.error instanceof Error ? rightData.error.message : String(rightData.error)) : null,
        leftRelationshipsError: leftRelationshipsData?.error ? (leftRelationshipsData.error instanceof Error ? leftRelationshipsData.error.message : String(leftRelationshipsData.error)) : null,
        rightRelationshipsError: rightRelationshipsData?.error ? (rightRelationshipsData.error instanceof Error ? rightRelationshipsData.error.message : String(rightRelationshipsData.error)) : null,
        leftHasData: !!leftTableData,
        rightHasData: !!rightTableData,
        leftRelationshipsCount: leftRelationships.length,
        rightRelationshipsCount: rightRelationships.length,
        open,
      });
    }
  }, [leftData.error, rightData.error, leftData.isLoading, rightData.isLoading, leftTableData, rightTableData, open, leftRelationshipsData?.error, leftRelationshipsData?.isLoading, rightRelationshipsData?.error, rightRelationshipsData?.isLoading, leftRelationships.length, rightRelationships.length, flowLog]);

  // Get columns for each table separately
  const leftTableColumns = useMemo(() => {
    return (leftTableData?.columns || []).map(c => String(c).trim());
  }, [leftTableData?.columns]);

  const rightTableColumns = useMemo(() => {
    return (rightTableData?.columns || []).map(c => String(c).trim());
  }, [rightTableData?.columns]);

  // Note: allColumns is kept for potential future use in comparison logic
  // Currently, columnsToCompare uses common columns between left and right tables

  // Validate combined columns
  const validatedCombinedColumns = useMemo(() => {
    const leftValid = validateCombinedColumns(
      combinedColumns.filter(c => c.side === "left"),
      leftTableColumns
    );
    const rightValid = validateCombinedColumns(
      combinedColumns.filter(c => c.side === "right"),
      rightTableColumns
    );
    
    return [...leftValid.valid, ...rightValid.valid];
  }, [combinedColumns, leftTableColumns, rightTableColumns]);

  // Get columns including combined ones for each side
  const leftAllColumnsWithCombined = useMemo(() => {
    const leftCombinedNames = validatedCombinedColumns
      .filter(c => c.side === "left")
      .map(c => c.name);
    return [...leftTableColumns, ...leftCombinedNames];
  }, [leftTableColumns, validatedCombinedColumns]);

  const rightAllColumnsWithCombined = useMemo(() => {
    const rightCombinedNames = validatedCombinedColumns
      .filter(c => c.side === "right")
      .map(c => c.name);
    return [...rightTableColumns, ...rightCombinedNames];
  }, [rightTableColumns, validatedCombinedColumns]);

  // Manage selected columns separately for left and right tables
  const [leftSelectedColumns, setLeftSelectedColumns] = useSyncedColumns(leftAllColumnsWithCombined);
  const [rightSelectedColumns, setRightSelectedColumns] = useSyncedColumns(rightAllColumnsWithCombined);

  // Track if user has manually modified left/right columns selection
  const [leftColumnsUserModified, setLeftColumnsUserModified] = useState(false);
  const [rightColumnsUserModified, setRightColumnsUserModified] = useState(false);

  // Get columns to compare (only columns that exist in both tables and are selected in both)
  const columnsToCompare = useMemo(() => {
    const commonColumns = leftTableColumns.filter(col => rightTableColumns.includes(col));
    return commonColumns.filter(col => 
      leftSelectedColumns.has(col) && rightSelectedColumns.has(col)
    );
  }, [leftTableColumns, rightTableColumns, leftSelectedColumns, rightSelectedColumns]);

  // Get columns to display for left table (only from left table's selected columns)
  const leftColumnsToDisplay = useMemo(() => {
    if (!leftTableData?.columns || leftTableData.columns.length === 0) {
      // Return empty array if no data, but keep combined columns if they exist
      return validatedCombinedColumns
        .filter(c => c.side === "left" && leftSelectedColumns.has(c.name))
        .map(c => c.name);
    }
    const originalCols = leftTableData.columns.map(c => String(c));
    const combinedCols = validatedCombinedColumns
      .filter(c => c.side === "left" && leftSelectedColumns.has(c.name))
      .map(c => c.name);
    
    // Filter to only show selected columns that exist in left table
    const selectedOriginal = getColumnsToDisplay(leftTableData.columns, leftSelectedColumns);
    
    // If user has modified and no columns selected, return empty (respect user's choice)
    // Only show all columns on initial load when no user modification yet
    if (leftSelectedColumns.size === 0) {
      if (leftColumnsUserModified) {
        // User has manually deselected all, respect their choice
        return combinedCols; // Only show combined columns if any
      }
      // Initial state, show all columns
      return originalCols;
    }
    
    // Combine selected original columns with combined columns
    return [...selectedOriginal, ...combinedCols];
  }, [leftSelectedColumns, leftTableData, validatedCombinedColumns, leftColumnsUserModified]);

  // Get columns to display for right table (only from right table's selected columns)
  const rightColumnsToDisplay = useMemo(() => {
    // Always include combined columns if they are selected, regardless of table data
    const combinedCols = validatedCombinedColumns
      .filter(c => c.side === "right" && rightSelectedColumns.has(c.name))
      .map(c => c.name);
    
    if (!rightTableData?.columns || rightTableData.columns.length === 0) {
      // Return combined columns if they exist, even if no table data
      return combinedCols;
    }
    
    const originalCols = rightTableData.columns.map(c => String(c));
    
    // Filter to only show selected columns that exist in right table
    const selectedOriginal = getColumnsToDisplay(rightTableData.columns, rightSelectedColumns);
    
    // If user has modified and no columns selected, return empty (respect user's choice)
    // Only show all columns on initial load when no user modification yet
    if (rightSelectedColumns.size === 0) {
      if (rightColumnsUserModified) {
        // User has manually deselected all, respect their choice
        return combinedCols; // Only show combined columns if any
      }
      // Initial state, show all columns
      return originalCols;
    }
    
    // Combine selected original columns with combined columns
    // Always include combined columns even if they're not in the original table columns
    return [...selectedOriginal, ...combinedCols];
  }, [rightSelectedColumns, rightTableData, validatedCombinedColumns, rightColumnsUserModified]);

  // Process rows to include combined column values
  const leftRowsWithCombined = useMemo(() => {
    if (!leftTableData?.rows) return [];
    return leftTableData.rows.map(row => {
      const newRow = { ...row };
      validatedCombinedColumns
        .filter(c => c.side === "left")
        .forEach(combined => {
          newRow[combined.name] = getColumnValue(row, combined.name, validatedCombinedColumns);
        });
      return newRow;
    });
  }, [leftTableData, validatedCombinedColumns]);

  const rightRowsWithCombined = useMemo(() => {
    if (!rightTableData?.rows) return [];
    return rightTableData.rows.map(row => {
      const newRow = { ...row };
      validatedCombinedColumns
        .filter(c => c.side === "right")
        .forEach(combined => {
          newRow[combined.name] = getColumnValue(row, combined.name, validatedCombinedColumns);
        });
      return newRow;
    });
  }, [rightTableData, validatedCombinedColumns]);

  // Log when combined columns change
  useEffect(() => {
    if (flowLog && open && combinedColumns.length > 0) {
      const leftCombined = combinedColumns.filter(c => c.side === "left");
      const rightCombined = combinedColumns.filter(c => c.side === "right");
      flowLog.info('Combined columns updated', {
        totalCombined: combinedColumns.length,
        leftCombined: leftCombined.map(c => ({
          name: c.name,
          sourceColumns: [...c.sourceColumns].sort(),
        })).sort((a, b) => a.name.localeCompare(b.name)),
        rightCombined: rightCombined.map(c => ({
          name: c.name,
          sourceColumns: [...c.sourceColumns].sort(),
        })).sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }, [combinedColumns, flowLog, open]);

  // Log when column selection changes
  useEffect(() => {
    if (flowLog && open && (leftColumnsUserModified || rightColumnsUserModified)) {
      const leftSelectedList = Array.from(leftSelectedColumns).sort();
      const rightSelectedList = Array.from(rightSelectedColumns).sort();
      
      // Get sample values for left table
      const leftSampleValues: Record<string, unknown> = {};
      if (leftRowsWithCombined.length > 0 && leftSelectedList.length > 0) {
        const firstRow = leftRowsWithCombined[0];
        leftSelectedList.forEach(col => {
          if (col in firstRow) {
            leftSampleValues[col] = firstRow[col];
          }
        });
      }
      
      // Get sample values for right table
      const rightSampleValues: Record<string, unknown> = {};
      if (rightRowsWithCombined.length > 0 && rightSelectedList.length > 0) {
        const firstRow = rightRowsWithCombined[0];
        rightSelectedList.forEach(col => {
          if (col in firstRow) {
            rightSampleValues[col] = firstRow[col];
          }
        });
      }
      
      flowLog.info('Column selection changed', {
        leftSelected: {
          count: leftSelectedColumns.size,
          columns: leftSelectedList,
          sampleValues: leftSampleValues,
        },
        rightSelected: {
          count: rightSelectedColumns.size,
          columns: rightSelectedList,
          sampleValues: rightSampleValues,
        },
        columnsToCompare: {
          count: columnsToCompare.length,
          columns: columnsToCompare.sort(),
        },
      });
    }
  }, [leftSelectedColumns, rightSelectedColumns, leftColumnsUserModified, rightColumnsUserModified, columnsToCompare, leftRowsWithCombined, rightRowsWithCombined, flowLog, open]);

  // Log when columns to display change (after combine and selection)
  useEffect(() => {
    if (flowLog && open && leftTableData && rightTableData) {
      const leftDisplayedSorted = [...leftColumnsToDisplay].sort();
      const rightDisplayedSorted = [...rightColumnsToDisplay].sort();
      
      flowLog.debug('Columns to display updated', {
        left: {
          total: leftColumnsToDisplay.length,
          original: leftTableColumns.length,
          combined: validatedCombinedColumns.filter(c => c.side === "left").length,
          displayed: leftDisplayedSorted,
        },
        right: {
          total: rightColumnsToDisplay.length,
          original: rightTableColumns.length,
          combined: validatedCombinedColumns.filter(c => c.side === "right").length,
          displayed: rightDisplayedSorted,
        },
        columnsToCompare: {
          count: columnsToCompare.length,
          columns: columnsToCompare.sort(),
        },
      });
    }
  }, [leftColumnsToDisplay, rightColumnsToDisplay, leftTableColumns, rightTableColumns, validatedCombinedColumns, columnsToCompare, leftTableData, rightTableData, flowLog, open]);

  const leftDataQuality = useMemo(
    () =>
      analyzeDataQuality(leftRowsWithCombined || [], leftColumnsToDisplay, {
        nameColumns: ["Oid"],
      }),
    [leftRowsWithCombined, leftColumnsToDisplay]
  );

  const rightDataQuality = useMemo(
    () =>
      analyzeDataQuality(rightRowsWithCombined || [], rightColumnsToDisplay, {
        nameColumns: ["Oid"],
      }),
    [rightRowsWithCombined, rightColumnsToDisplay]
  );

  // Validate data when show reference is enabled
  const dataValidation = useMemo(() => {
    if (!includeReferences) {
      return { isValid: true, errors: [] };
    }
    
    const errors: string[] = [];
    
    // Check if both tables have data
    if (!leftTableData || !rightTableData) {
      errors.push("Cả hai bảng phải có dữ liệu để so sánh với reference");
    }
    
    // Check if both tables have rows
    if (leftTableData && rightTableData) {
      if (leftTableData.rows.length === 0 && rightTableData.rows.length === 0) {
        errors.push("Cả hai bảng đều không có dữ liệu");
      }
    }
    
    // Check if relationships exist for both tables
    if (leftRelationships.length === 0 && rightRelationships.length === 0) {
      errors.push("Không tìm thấy relationships cho cả hai bảng");
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [includeReferences, leftTableData, rightTableData, leftRelationships.length, rightRelationships.length]);

  // Compare rows using optimized hook (with combined columns support)
  // Note: Combined columns are already processed in leftRowsWithCombined and rightRowsWithCombined
  const comparisonResult = useTableComparison({ 
    leftRows: leftRowsWithCombined || [],
    rightRows: rightRowsWithCombined || [],
    columnsToCompare,
  });

  // Calculate comparison statistics
  const comparisonStats = useMemo(() => {
    // Get actual total rows from table data (not limited rows)
    const leftTotalRows = finalLeftTableData?.totalRows ?? 0;
    const rightTotalRows = finalRightTableData?.totalRows ?? 0;
    const actualTotalRows = Math.max(leftTotalRows, rightTotalRows);

    // Get rows that were actually compared
    // If comparisonResult exists, use its size (actual compared rows)
    // Otherwise, use the max of loaded rows
    const leftLoadedRows = leftRowsWithCombined?.length || 0;
    const rightLoadedRows = rightRowsWithCombined?.length || 0;
    const comparedRowsCount = comparisonResult?.size ?? Math.max(leftLoadedRows, rightLoadedRows);

    if (!comparisonResult || comparisonResult.size === 0) {
      return {
        totalRows: actualTotalRows,
        comparedRows: comparedRowsCount,
        sameRows: 0,
        differentRows: 0,
        leftOnlyRows: 0,
        rightOnlyRows: 0,
        totalColumns: Math.max(
          leftTableData?.columns?.length || 0,
          rightTableData?.columns?.length || 0
        ),
        comparedColumns: columnsToCompare.length,
        leftTotalRows,
        rightTotalRows,
      };
    }

    let sameRows = 0;
    let differentRows = 0;
    let leftOnlyRows = 0;
    let rightOnlyRows = 0;

    comparisonResult.forEach((result) => {
      switch (result.status) {
        case "same":
          sameRows++;
          break;
        case "different":
          differentRows++;
          break;
        case "left-only":
          leftOnlyRows++;
          break;
        case "right-only":
          rightOnlyRows++;
          break;
      }
    });

    // Calculate compared columns
    // Include columns that are in columnsToCompare (common columns selected in both sides)
    let comparedColsCount = columnsToCompare.length;
    
    // Also count combined columns that have the same name and are selected in both sides
    const combinedColumnNames = new Set<string>();
    validatedCombinedColumns.forEach((combined) => {
      if (combined.name && !combinedColumnNames.has(combined.name)) {
        combinedColumnNames.add(combined.name);
      }
    });
    
    // Check if any combined column name is selected in both sides
    combinedColumnNames.forEach((combinedName) => {
      const leftHas = leftSelectedColumns.has(combinedName);
      const rightHas = rightSelectedColumns.has(combinedName);
      const leftHasCombined = validatedCombinedColumns.some(
        (c) => c.side === "left" && c.name === combinedName
      );
      const rightHasCombined = validatedCombinedColumns.some(
        (c) => c.side === "right" && c.name === combinedName
      );
      
      // If both sides have this combined column and it's selected in both, count it
      if (leftHas && rightHas && leftHasCombined && rightHasCombined && !columnsToCompare.includes(combinedName)) {
        comparedColsCount++;
      }
    });

    return {
      totalRows: actualTotalRows,
      comparedRows: comparedRowsCount,
      sameRows,
      differentRows,
      leftOnlyRows,
      rightOnlyRows,
      totalColumns: Math.max(
        leftTableData?.columns?.length || 0,
        rightTableData?.columns?.length || 0
      ),
      comparedColumns: comparedColsCount,
      leftTotalRows,
      rightTotalRows,
    };
  }, [
    comparisonResult,
    leftRowsWithCombined,
    rightRowsWithCombined,
    leftTableData,
    rightTableData,
    columnsToCompare,
    validatedCombinedColumns,
    leftSelectedColumns,
    rightSelectedColumns,
  ]);

  // Memoize computed values for performance
  const isLoading = useMemo(() => finalLeftIsLoading || finalRightIsLoading, [finalLeftIsLoading, finalRightIsLoading]);
  const hasError = useMemo(() => finalLeftError || finalRightError, [finalLeftError, finalRightError]);
  
  // Debug: Log render conditions
  useEffect(() => {
    if (flowLog) {
      flowLog.debug('Render conditions', {
        isLoading,
        hasError,
        leftTableDataExists: !!leftTableData,
        rightTableDataExists: !!rightTableData,
        leftTableDataRows: leftTableData?.rows?.length ?? 0,
        rightTableDataRows: rightTableData?.rows?.length ?? 0,
        leftTableDataColumns: leftTableData?.columns?.length ?? 0,
        rightTableDataColumns: rightTableData?.columns?.length ?? 0,
        shouldRenderTables: !isLoading && !hasError && !!leftTableData && !!rightTableData,
      });
    }
  }, [isLoading, hasError, leftTableData, rightTableData, flowLog]);
  
  // Memoize active filter counts
  const leftActiveFilterCount = leftTableFilters.activeFilterCount;
  const rightActiveFilterCount = rightTableFilters.activeFilterCount;
  

  const content = (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Compare Tables
            </h2>
            <p className="text-xs text-muted-foreground">
              {leftTable.schemaName}.{leftTable.tableName} vs{" "}
              {rightTable.schemaName}.{rightTable.tableName}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSummaryDialog(true)}
            className="ml-4"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Tổng kết so sánh
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Field orientation="horizontal" className="gap-2 items-center">
            <FieldLabel className="text-xs cursor-pointer" onClick={() => setIncludeReferences(!includeReferences)}>
              Show References
            </FieldLabel>
            <FieldContent>
              <input
                type="checkbox"
                checked={includeReferences}
                onChange={(e) => setIncludeReferences(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
            </FieldContent>
          </Field>
          {!dataValidation.isValid && dataValidation.errors.length > 0 && (
            <div className="text-xs text-destructive">
              {dataValidation.errors[0]}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Only show global loading state on initial load when both tables have no data */}
        {!leftTableData && !rightTableData && (
          <ComparisonLoadingState
            isLoading={isLoading}
            loadingStates={{
              leftData: finalLeftIsLoading,
              rightData: finalRightIsLoading,
              leftRelationships: leftRelationshipsData?.isLoading ?? false,
              rightRelationships: rightRelationshipsData?.isLoading ?? false,
            }}
            hasError={!!hasError}
            errors={{
              leftData: finalLeftError,
              rightData: finalRightError,
              leftRelationships: leftRelationshipsData?.error,
              rightRelationships: rightRelationshipsData?.error,
            }}
          />
        )}
        {/* Show tables even if one is loading - each table manages its own loading overlay */}
        {!hasError ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Side by Side Tables */}
            <div className="flex-1 grid grid-cols-2 gap-0 min-h-0 overflow-hidden">
              {/* Left Table */}
              <div className="flex flex-col border-r border-border min-h-0">
                {leftTableData && (
                  <div className="p-2 border-b border-border bg-muted/30">
                    <ColumnSelector
                      availableColumns={leftTableColumns}
                      selectedColumns={leftSelectedColumns}
                      onSelectionChange={(selected) => {
                        if (flowLog) {
                          const added = Array.from(selected).filter(col => !leftSelectedColumns.has(col)).sort();
                          const removed = Array.from(leftSelectedColumns).filter(col => !selected.has(col)).sort();
                          const selectedList = Array.from(selected).sort();
                          
                          // Get sample values for selected columns (first row)
                          const sampleValues: Record<string, unknown> = {};
                          if (leftRowsWithCombined.length > 0 && selectedList.length > 0) {
                            const firstRow = leftRowsWithCombined[0];
                            selectedList.forEach(col => {
                              if (col in firstRow) {
                                sampleValues[col] = firstRow[col];
                              }
                            });
                          }
                          
                          flowLog.info('Left table column selection changed', {
                            previousCount: leftSelectedColumns.size,
                            newCount: selected.size,
                            added: added,
                            removed: removed,
                            selected: selectedList,
                            sampleValues: sampleValues,
                          });
                        }
                        setLeftColumnsUserModified(true);
                        setLeftSelectedColumns(selected);
                      }}
                      combinedColumns={validatedCombinedColumns}
                      onCombinedColumnsChange={(combined) => {
                        if (flowLog) {
                          const leftCombined = combined.filter(c => c.side === "left");
                          flowLog.info('Left table combined columns changed', {
                            previousCount: validatedCombinedColumns.filter(c => c.side === "left").length,
                            newCount: leftCombined.length,
                            combined: leftCombined.map(c => ({
                              name: c.name,
                              sourceColumns: c.sourceColumns,
                            })),
                          });
                        }
                        setCombinedColumns(combined);
                      }}
                      side="left"
                      tableColumns={leftTableColumns}
                    />
                  </div>
                )}
                <ComparisonTable
                  databaseName={leftTable.databaseName}
                  schemaName={leftTable.schemaName}
                  tableName={leftTable.tableName}
                  columns={leftColumnsToDisplay}
                  rows={leftRowsWithCombined || []}
                  filters={leftTableFilters}
                  showFilters={showLeftFilters}
                  onToggleFilters={() => setShowLeftFilters(!showLeftFilters)}
                  activeFilterCount={leftActiveFilterCount}
                  comparisonResult={comparisonResult}
                  side="left"
                  relationships={leftRelationships}
                  includeReferences={includeReferences}
                  totalRows={leftTableData?.totalRows}
                  filteredRowCount={leftTableData?.filteredRowCount}
                  limit={leftLimit}
                  onLimitChange={setLeftLimit}
                  isLoading={finalLeftIsLoading}
                  hasMore={finalLeftTableData?.hasMore}
                  pagination={leftPagination}
                  onTableChange={onTableChange ? (schema, table) => onTableChange(leftTable.databaseName, schema, table) : undefined}
                  duplicateGroups={leftDataQuality.duplicateGroups}
                  duplicateIndexSet={leftDataQuality.duplicateIndexSet}
                  redundantColumns={leftDataQuality.redundantColumns}
                  nameDuplicateGroups={leftDataQuality.nameDuplicateGroups}
                  nameDuplicateIndexSet={leftDataQuality.nameDuplicateIndexSet}
                  combinedColumns={validatedCombinedColumns.filter(c => c.side === "left")}
                  columnsToCompare={columnsToCompare}
                  flowLog={flowLog}
                  containerClassName="h-full w-full mx-auto px-4 max-h-[500px]"
                />
              </div>

              {/* Right Table */}
              <div className="flex flex-col border-l border-border min-h-0">
                {rightTableData && (
                  <div className="p-2 border-b border-border bg-muted/30">
                    <ColumnSelector
                      availableColumns={rightTableColumns}
                      selectedColumns={rightSelectedColumns}
                      onSelectionChange={(selected) => {
                        if (flowLog) {
                          const added = Array.from(selected).filter(col => !rightSelectedColumns.has(col)).sort();
                          const removed = Array.from(rightSelectedColumns).filter(col => !selected.has(col)).sort();
                          const selectedList = Array.from(selected).sort();
                          
                          // Get sample values for selected columns (first row)
                          const sampleValues: Record<string, unknown> = {};
                          if (rightRowsWithCombined.length > 0 && selectedList.length > 0) {
                            const firstRow = rightRowsWithCombined[0];
                            selectedList.forEach(col => {
                              if (col in firstRow) {
                                sampleValues[col] = firstRow[col];
                              }
                            });
                          }
                          
                          flowLog.info('Right table column selection changed', {
                            previousCount: rightSelectedColumns.size,
                            newCount: selected.size,
                            added: added,
                            removed: removed,
                            selected: selectedList,
                            sampleValues: sampleValues,
                          });
                        }
                        setRightColumnsUserModified(true);
                        setRightSelectedColumns(selected);
                      }}
                      combinedColumns={validatedCombinedColumns}
                      onCombinedColumnsChange={(combined) => {
                        if (flowLog) {
                          const rightCombined = combined.filter(c => c.side === "right");
                          flowLog.info('Right table combined columns changed', {
                            previousCount: validatedCombinedColumns.filter(c => c.side === "right").length,
                            newCount: rightCombined.length,
                            combined: rightCombined.map(c => ({
                              name: c.name,
                              sourceColumns: [...c.sourceColumns].sort(),
                            })).sort((a, b) => a.name.localeCompare(b.name)),
                          });
                        }
                        setCombinedColumns(combined);
                      }}
                      side="right"
                      tableColumns={rightTableColumns}
                    />
                  </div>
                )}
                <ComparisonTable
                  databaseName={rightTable.databaseName}
                  schemaName={rightTable.schemaName}
                  tableName={rightTable.tableName}
                  columns={rightColumnsToDisplay}
                  rows={rightRowsWithCombined || []}
                  filters={rightTableFilters}
                  showFilters={showRightFilters}
                  onToggleFilters={() => setShowRightFilters(!showRightFilters)}
                  activeFilterCount={rightActiveFilterCount}
                  comparisonResult={comparisonResult}
                  side="right"
                  relationships={rightRelationships}
                  includeReferences={includeReferences}
                  totalRows={rightTableData?.totalRows}
                  filteredRowCount={rightTableData?.filteredRowCount}
                  limit={rightLimit}
                  onLimitChange={setRightLimit}
                  isLoading={finalRightIsLoading}
                  hasMore={finalRightTableData?.hasMore}
                  pagination={rightPagination}
                  onTableChange={onTableChange ? (schema, table) => onTableChange(rightTable.databaseName, schema, table) : undefined}
                  duplicateGroups={rightDataQuality.duplicateGroups}
                  duplicateIndexSet={rightDataQuality.duplicateIndexSet}
                  redundantColumns={rightDataQuality.redundantColumns}
                  nameDuplicateGroups={rightDataQuality.nameDuplicateGroups}
                  nameDuplicateIndexSet={rightDataQuality.nameDuplicateIndexSet}
                  combinedColumns={validatedCombinedColumns.filter(c => c.side === "right")}
                  columnsToCompare={columnsToCompare}
                  flowLog={flowLog}
                  containerClassName="h-full w-full mx-auto px-4 max-h-[500px]"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tổng kết so sánh 2 bảng</DialogTitle>
            <DialogDescription>
              Thống kê chi tiết về sự khác biệt giữa {leftTable.schemaName}.{leftTable.tableName} và {rightTable.schemaName}.{rightTable.tableName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Table Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Thông tin bảng</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Bảng trái</div>
                  <div className="font-medium">{leftTable.databaseName}</div>
                  <div className="text-sm">{leftTable.schemaName}.{leftTable.tableName}</div>
                  <div className="text-xs text-muted-foreground">
                    {leftTableData?.totalRows ?? 0} rows • {leftTableData?.columns?.length ?? 0} columns
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Bảng phải</div>
                  <div className="font-medium">{rightTable.databaseName}</div>
                  <div className="text-sm">{rightTable.schemaName}.{rightTable.tableName}</div>
                  <div className="text-xs text-muted-foreground">
                    {rightTableData?.totalRows ?? 0} rows • {rightTableData?.columns?.length ?? 0} columns
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Comparison Statistics */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Thống kê so sánh</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tổng số rows (thực tế)</span>
                    <Badge variant="secondary">{comparisonStats.totalRows}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rows đã so sánh</span>
                    <Badge variant="outline">{comparisonStats.comparedRows}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rows giống nhau</span>
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      {comparisonStats.sameRows}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rows khác nhau</span>
                    <Badge variant="default" className="bg-red-500 hover:bg-red-600">
                      {comparisonStats.differentRows}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Chỉ có bên trái</span>
                    <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                      {comparisonStats.leftOnlyRows}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Chỉ có bên phải</span>
                    <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                      {comparisonStats.rightOnlyRows}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Columns so sánh</span>
                    <Badge variant="secondary">{comparisonStats.comparedColumns}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tổng columns</span>
                    <Badge variant="outline">{comparisonStats.totalColumns}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Percentage Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Tỷ lệ (trong số rows đã so sánh)</h3>
              <div className="space-y-2">
                {comparisonStats.comparedRows > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Giống nhau</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${(comparisonStats.sameRows / comparisonStats.comparedRows) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {((comparisonStats.sameRows / comparisonStats.comparedRows) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Khác nhau</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{
                              width: `${(comparisonStats.differentRows / comparisonStats.comparedRows) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {((comparisonStats.differentRows / comparisonStats.comparedRows) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Chỉ có một bên</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500"
                            style={{
                              width: `${((comparisonStats.leftOnlyRows + comparisonStats.rightOnlyRows) / comparisonStats.comparedRows) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {(((comparisonStats.leftOnlyRows + comparisonStats.rightOnlyRows) / comparisonStats.comparedRows) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {comparisonStats.comparedRows === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    Chưa có dữ liệu để so sánh
                  </div>
                )}
              </div>
            </div>

            {/* Additional Info */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Thông tin bổ sung</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-3 border rounded-lg">
                  <div className="text-xs font-medium mb-2">Cấu hình so sánh</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Combined columns:</span>
                      <span className="font-medium">{validatedCombinedColumns.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active filters:</span>
                      <span className="font-medium">{leftActiveFilterCount + rightActiveFilterCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Include references:</span>
                      <span className="font-medium">{includeReferences ? "Có" : "Không"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Left limit:</span>
                      <span className="font-medium">{leftLimit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Right limit:</span>
                      <span className="font-medium">{rightLimit}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-3 border rounded-lg">
                  <div className="text-xs font-medium mb-2">Columns được so sánh</div>
                  {columnsToCompare.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        {columnsToCompare.length} columns:
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {columnsToCompare.slice(0, 10).map((col) => (
                          <div key={col} className="text-xs px-2 py-1 bg-muted rounded">
                            {col}
                          </div>
                        ))}
                        {columnsToCompare.length > 10 && (
                          <div className="text-xs text-muted-foreground italic">
                            ... và {columnsToCompare.length - 10} columns khác
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      Chưa có columns nào được chọn để so sánh
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Row Counts */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Tóm tắt số lượng</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{comparisonStats.leftTotalRows}</div>
                  <div className="text-xs text-muted-foreground mt-1">Rows bảng trái</div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{comparisonStats.comparedRows}</div>
                  <div className="text-xs text-muted-foreground mt-1">Rows đã so sánh</div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{comparisonStats.rightTotalRows}</div>
                  <div className="text-xs text-muted-foreground mt-1">Rows bảng phải</div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Debug: Log dialog rendering
  useEffect(() => {
    if (flowLog) {
      flowLog.debug('Dialog rendering state', {
        asDialog,
        open,
        isLoading,
        hasError,
        leftTableDataExists: !!leftTableData,
        rightTableDataExists: !!rightTableData,
        shouldRenderContent: !isLoading && !hasError && !!leftTableData && !!rightTableData,
      });
    }
  }, [asDialog, open, isLoading, hasError, leftTableData, rightTableData, flowLog]);

  if (asDialog) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen && onClose) {
          onClose();
        }
      }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] w-full pb-12" showCloseButton={true}>
          <DialogHeader className="sr-only">
            <DialogTitle>
              Compare Tables: {leftTable.schemaName}.{leftTable.tableName} vs{" "}
              {rightTable.schemaName}.{rightTable.tableName}
            </DialogTitle>
            <DialogDescription>
              Comparing data from {leftTable.databaseName} and{" "}
              {rightTable.databaseName} databases
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}

