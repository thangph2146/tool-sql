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
import { normalizeForComparison, isNullRow } from "@/lib/utils/table-comparison-utils";

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
  
  // Track column priorities and sort order for left and right tables
  const [leftColumnPriorities, setLeftColumnPriorities] = useState<Map<string, number>>(new Map());
  const [rightColumnPriorities, setRightColumnPriorities] = useState<Map<string, number>>(new Map());
  const [leftSortOrder, setLeftSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");
  const [rightSortOrder, setRightSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");

  // Get columns to compare (only columns that exist in both tables and are selected in both)
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
    const allColumns = [...selectedOriginal, ...combinedCols];
    
    // Sort by priority (lower number = higher priority), then by sortOrder
    return allColumns.sort((a, b) => {
      const priorityA = leftColumnPriorities.get(a) ?? Infinity;
      const priorityB = leftColumnPriorities.get(b) ?? Infinity;
      
      // If one has priority and the other doesn't, prioritize the one with priority
      if (priorityA !== Infinity && priorityB === Infinity) {
        return -1; // a comes first
      }
      if (priorityA === Infinity && priorityB !== Infinity) {
        return 1; // b comes first
      }
      
      // If both have priority, sort by priority value
      if (priorityA !== Infinity && priorityB !== Infinity) {
        if (priorityA !== priorityB) {
          return priorityA - priorityB; // Lower priority number = higher priority
        }
      }
      
      // If same priority or no priority, sort by sortOrder
      if (leftSortOrder === "alphabetical") {
        return a.localeCompare(b);
      } else if (leftSortOrder === "newest") {
        // For regular columns, use their index in leftTableColumns
        // For combined columns, use the index of their first source column
        const indexA = leftTableColumns.indexOf(a) !== -1 
          ? leftTableColumns.indexOf(a)
          : (validatedCombinedColumns.find(c => c.side === "left" && c.name === a)?.sourceColumns[0] 
              ? leftTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "left" && c.name === a)!.sourceColumns[0])
              : -1);
        const indexB = leftTableColumns.indexOf(b) !== -1
          ? leftTableColumns.indexOf(b)
          : (validatedCombinedColumns.find(c => c.side === "left" && c.name === b)?.sourceColumns[0]
              ? leftTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "left" && c.name === b)!.sourceColumns[0])
              : -1);
        return indexB - indexA; // Reverse order (newest first)
      } else { // oldest
        const indexA = leftTableColumns.indexOf(a) !== -1
          ? leftTableColumns.indexOf(a)
          : (validatedCombinedColumns.find(c => c.side === "left" && c.name === a)?.sourceColumns[0]
              ? leftTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "left" && c.name === a)!.sourceColumns[0])
              : -1);
        const indexB = leftTableColumns.indexOf(b) !== -1
          ? leftTableColumns.indexOf(b)
          : (validatedCombinedColumns.find(c => c.side === "left" && c.name === b)?.sourceColumns[0]
              ? leftTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "left" && c.name === b)!.sourceColumns[0])
              : -1);
        return indexA - indexB; // Normal order (oldest first)
      }
    });
  }, [leftSelectedColumns, leftTableData, validatedCombinedColumns, leftColumnsUserModified, leftColumnPriorities, leftSortOrder, leftTableColumns]);

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
    const allColumns = [...selectedOriginal, ...combinedCols];
    
    // Sort by priority (lower number = higher priority), then by sortOrder
    return allColumns.sort((a, b) => {
      const priorityA = rightColumnPriorities.get(a) ?? Infinity;
      const priorityB = rightColumnPriorities.get(b) ?? Infinity;
      
      // If one has priority and the other doesn't, prioritize the one with priority
      if (priorityA !== Infinity && priorityB === Infinity) {
        return -1; // a comes first
      }
      if (priorityA === Infinity && priorityB !== Infinity) {
        return 1; // b comes first
      }
      
      // If both have priority, sort by priority value
      if (priorityA !== Infinity && priorityB !== Infinity) {
        if (priorityA !== priorityB) {
          return priorityA - priorityB; // Lower priority number = higher priority
        }
      }
      
      // If same priority or no priority, sort by sortOrder
      if (rightSortOrder === "alphabetical") {
        return a.localeCompare(b);
      } else if (rightSortOrder === "newest") {
        // For regular columns, use their index in rightTableColumns
        // For combined columns, use the index of their first source column
        const indexA = rightTableColumns.indexOf(a) !== -1
          ? rightTableColumns.indexOf(a)
          : (validatedCombinedColumns.find(c => c.side === "right" && c.name === a)?.sourceColumns[0]
              ? rightTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "right" && c.name === a)!.sourceColumns[0])
              : -1);
        const indexB = rightTableColumns.indexOf(b) !== -1
          ? rightTableColumns.indexOf(b)
          : (validatedCombinedColumns.find(c => c.side === "right" && c.name === b)?.sourceColumns[0]
              ? rightTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "right" && c.name === b)!.sourceColumns[0])
              : -1);
        return indexB - indexA; // Reverse order (newest first)
      } else { // oldest
        const indexA = rightTableColumns.indexOf(a) !== -1
          ? rightTableColumns.indexOf(a)
          : (validatedCombinedColumns.find(c => c.side === "right" && c.name === a)?.sourceColumns[0]
              ? rightTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "right" && c.name === a)!.sourceColumns[0])
              : -1);
        const indexB = rightTableColumns.indexOf(b) !== -1
          ? rightTableColumns.indexOf(b)
          : (validatedCombinedColumns.find(c => c.side === "right" && c.name === b)?.sourceColumns[0]
              ? rightTableColumns.indexOf(validatedCombinedColumns.find(c => c.side === "right" && c.name === b)!.sourceColumns[0])
              : -1);
        return indexA - indexB; // Normal order (oldest first)
      }
    });
  }, [rightSelectedColumns, rightTableData, validatedCombinedColumns, rightColumnsUserModified, rightColumnPriorities, rightSortOrder, rightTableColumns]);

  // Get columns to compare - includes all columns that are displayed in both sides
  // This includes both original columns and combined columns
  const columnsToCompare = useMemo(() => {
    // Get all displayed columns from both sides (includes combined columns)
    const leftDisplayed = new Set(leftColumnsToDisplay);
    const rightDisplayed = new Set(rightColumnsToDisplay);
    
    // Find intersection - columns that are displayed in both sides
    const commonDisplayed = Array.from(leftDisplayed).filter(col => rightDisplayed.has(col));
    
    return commonDisplayed;
  }, [leftColumnsToDisplay, rightColumnsToDisplay]);

  // Process rows to include combined column values and synchronize row count
  // Use the table with more rows as the base, and pad the other table with null rows
  const leftRowsWithCombined = useMemo(() => {
    if (!leftTableData?.rows) return [];
    const processedRows = leftTableData.rows.map(row => {
      const newRow = { ...row };
      validatedCombinedColumns
        .filter(c => c.side === "left")
        .forEach(combined => {
          newRow[combined.name] = getColumnValue(row, combined.name, validatedCombinedColumns);
        });
      return newRow;
    });
    return processedRows;
  }, [leftTableData, validatedCombinedColumns]);

  const rightRowsWithCombined = useMemo(() => {
    if (!rightTableData?.rows) return [];
    const processedRows = rightTableData.rows.map(row => {
      const newRow = { ...row };
      validatedCombinedColumns
        .filter(c => c.side === "right")
        .forEach(combined => {
          newRow[combined.name] = getColumnValue(row, combined.name, validatedCombinedColumns);
        });
      return newRow;
    });
    return processedRows;
  }, [rightTableData, validatedCombinedColumns]);

  // Helper function to create comparison key (using same logic as createComparisonKey in utils)
  const createSortKey = useCallback((row: Record<string, unknown>, columns: string[]): string => {
    if (columns.length === 0) return '';
    return columns
      .map(col => {
        const val = row[col];
        // Use normalizeForComparison to extract actual value and normalize
        const normalized = normalizeForComparison(val);
        if (normalized === null || normalized === undefined) {
          return 'null';
        }
        // For objects/arrays, use JSON.stringify for consistent key
        if (typeof normalized === 'object') {
          try {
            return JSON.stringify(normalized);
          } catch {
            return String(normalized);
          }
        }
        // For strings, use lowercase for case-insensitive comparison
        if (typeof normalized === 'string') {
          return normalized.toLowerCase();
        }
        return String(normalized);
      })
      .join('|');
  }, []);

  // Align rows: match rows with same values and ensure they have the same index
  // This creates aligned arrays where matched rows are at the same index
  const { synchronizedLeftRows, synchronizedRightRows } = useMemo(() => {
    // Helper function to get all unique column names from rows
    const getAllColumnsFromRows = (rows: Record<string, unknown>[]): string[] => {
      if (rows.length === 0) return [];
      const allColumns = new Set<string>();
      rows.forEach(row => {
        Object.keys(row).forEach(key => allColumns.add(key));
      });
      return Array.from(allColumns);
    };

    // Get all columns from actual rows to ensure null rows have the same structure
    const leftAllColumns = leftRowsWithCombined.length > 0 
      ? getAllColumnsFromRows(leftRowsWithCombined)
      : (leftTableData?.columns?.map(c => String(c)) || []);
    const rightAllColumns = rightRowsWithCombined.length > 0 
      ? getAllColumnsFromRows(rightRowsWithCombined)
      : (rightTableData?.columns?.map(c => String(c)) || []);

    // Helper function to create a null row with all columns set to null
    const createNullRow = (columns: string[]): Record<string, unknown> => {
      const nullRow: Record<string, unknown> = {};
      columns.forEach(col => { nullRow[col] = null; });
      return nullRow;
    };

    if (columnsToCompare.length === 0) {
      // No columns to compare, just pad with null rows
      const leftCount = leftRowsWithCombined.length;
      const rightCount = rightRowsWithCombined.length;
      const maxCount = Math.max(leftCount, rightCount);
      
      const alignedLeft: Record<string, unknown>[] = [...leftRowsWithCombined];
      const alignedRight: Record<string, unknown>[] = [...rightRowsWithCombined];
      
      // Pad left if needed
      if (leftCount < maxCount) {
        for (let i = leftCount; i < maxCount; i++) {
          alignedLeft.push(createNullRow(leftAllColumns));
        }
      }
      
      // Pad right if needed
      if (rightCount < maxCount) {
        for (let i = rightCount; i < maxCount; i++) {
          alignedRight.push(createNullRow(rightAllColumns));
        }
      }
      
      return { synchronizedLeftRows: alignedLeft, synchronizedRightRows: alignedRight };
    }

    // Create maps of rows by their comparison key
    const leftRowMap = new Map<string, Record<string, unknown>[]>();
    leftRowsWithCombined.forEach(row => {
      const key = createSortKey(row, columnsToCompare);
      if (!leftRowMap.has(key)) {
        leftRowMap.set(key, []);
      }
      leftRowMap.get(key)!.push(row);
    });

    const rightRowMap = new Map<string, Record<string, unknown>[]>();
    rightRowsWithCombined.forEach(row => {
      const key = createSortKey(row, columnsToCompare);
      if (!rightRowMap.has(key)) {
        rightRowMap.set(key, []);
      }
      rightRowMap.get(key)!.push(row);
    });

    // Get all unique keys and sort them
    const allKeys = Array.from(new Set([...leftRowMap.keys(), ...rightRowMap.keys()]));
    allKeys.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));

    // Build aligned arrays
    const alignedLeft: Record<string, unknown>[] = [];
    const alignedRight: Record<string, unknown>[] = [];

    allKeys.forEach(key => {
      const leftRows = leftRowMap.get(key) || [];
      const rightRows = rightRowMap.get(key) || [];
      const maxCount = Math.max(leftRows.length, rightRows.length);

      // Add matched rows
      for (let i = 0; i < maxCount; i++) {
        if (i < leftRows.length && i < rightRows.length) {
          // Both have rows at this position - match them
          alignedLeft.push(leftRows[i]);
          alignedRight.push(rightRows[i]);
        } else if (i < leftRows.length) {
          // Only left has row - pad right with null
          alignedLeft.push(leftRows[i]);
          alignedRight.push(createNullRow(rightAllColumns));
        } else {
          // Only right has row - pad left with null
          alignedLeft.push(createNullRow(leftAllColumns));
          alignedRight.push(rightRows[i]);
        }
      }
    });

    return { synchronizedLeftRows: alignedLeft, synchronizedRightRows: alignedRight };
  }, [
    leftRowsWithCombined,
    rightRowsWithCombined,
    columnsToCompare,
    createSortKey,
    leftTableData?.columns,
    rightTableData?.columns,
  ]);

  // Log row synchronization details for debugging
  useEffect(() => {
    if (flowLog && open && synchronizedLeftRows && synchronizedRightRows) {
      const sampleLeft = synchronizedLeftRows.slice(0, 5).map((row, idx) => {
        const key = columnsToCompare.length > 0 ? createSortKey(row, columnsToCompare) : `index-${idx}`;
        const sampleValues: Record<string, unknown> = {};
        columnsToCompare.slice(0, 3).forEach(col => {
          if (col in row) {
            sampleValues[col] = row[col];
          }
        });
        return { index: idx, key, sampleValues };
      });
      
      const sampleRight = synchronizedRightRows.slice(0, 5).map((row, idx) => {
        const key = columnsToCompare.length > 0 ? createSortKey(row, columnsToCompare) : `index-${idx}`;
        const sampleValues: Record<string, unknown> = {};
        columnsToCompare.slice(0, 3).forEach(col => {
          if (col in row) {
            sampleValues[col] = row[col];
          }
        });
        return { index: idx, key, sampleValues };
      });

      flowLog.info('Row synchronization details', {
        columnsToCompare: columnsToCompare.length > 0 ? columnsToCompare : 'NONE (padding by count)',
        leftRowsCount: synchronizedLeftRows.length,
        rightRowsCount: synchronizedRightRows.length,
        sampleLeft,
        sampleRight,
      });
    }
  }, [synchronizedLeftRows, synchronizedRightRows, columnsToCompare, createSortKey, flowLog, open]);

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

  const leftDataQuality = useMemo(() => {
    // Filter out null rows (padded rows) before analyzing duplicates
    // Null rows should not be considered as duplicates
    const synchronizedRows = synchronizedLeftRows || [];
    const actualRows: Record<string, unknown>[] = [];
    const actualToSynchronizedIndexMap = new Map<number, number>();
    
    synchronizedRows.forEach((row, synchronizedIndex) => {
      const isNull = isNullRow(row, leftColumnsToDisplay.length > 0 ? leftColumnsToDisplay : Object.keys(row));
      if (!isNull) {
        const actualIndex = actualRows.length;
        actualRows.push(row);
        actualToSynchronizedIndexMap.set(actualIndex, synchronizedIndex);
      }
    });
    
    // Use all available columns if leftColumnsToDisplay is empty or insufficient
    // This ensures duplicate detection works even when no columns are selected
    let columnsForAnalysis = leftColumnsToDisplay;
    if (columnsForAnalysis.length === 0 && actualRows.length > 0) {
      // Get all unique column keys from all rows
      const allColumns = new Set<string>();
      actualRows.forEach(row => {
        Object.keys(row).forEach(key => {
          // Exclude metadata columns
          if (!key.endsWith('_OriginalId') && !key.endsWith('_OriginalValue')) {
            allColumns.add(key);
          }
        });
      });
      columnsForAnalysis = Array.from(allColumns);
    }
    
    const quality = analyzeDataQuality(actualRows, columnsForAnalysis, {
      nameColumns: ["Oid"],
    });
    
    // Map indices from actual rows back to synchronized rows
    const remappedDuplicateGroups = quality.duplicateGroups.map(group => ({
      ...group,
      indices: group.indices.map(actualIdx => actualToSynchronizedIndexMap.get(actualIdx) ?? actualIdx),
    }));
    
    const remappedDuplicateIndexSet = new Set<number>();
    remappedDuplicateGroups.forEach(group => {
      group.indices.forEach(idx => remappedDuplicateIndexSet.add(idx));
    });
    
    const remappedNameDuplicateGroups = quality.nameDuplicateGroups.map(group => ({
      ...group,
      indices: group.indices.map(actualIdx => actualToSynchronizedIndexMap.get(actualIdx) ?? actualIdx),
    }));
    
    const remappedNameDuplicateIndexSet = new Set<number>();
    remappedNameDuplicateGroups.forEach(group => {
      group.indices.forEach(idx => remappedNameDuplicateIndexSet.add(idx));
    });
    
    return {
      ...quality,
      duplicateGroups: remappedDuplicateGroups,
      duplicateIndexSet: remappedDuplicateIndexSet,
      nameDuplicateGroups: remappedNameDuplicateGroups,
      nameDuplicateIndexSet: remappedNameDuplicateIndexSet,
    };
  }, [synchronizedLeftRows, leftColumnsToDisplay]);

  const rightDataQuality = useMemo(() => {
    // Filter out null rows (padded rows) before analyzing duplicates
    // Null rows should not be considered as duplicates
    const synchronizedRows = synchronizedRightRows || [];
    const actualRows: Record<string, unknown>[] = [];
    const actualToSynchronizedIndexMap = new Map<number, number>();
    
    synchronizedRows.forEach((row, synchronizedIndex) => {
      const isNull = isNullRow(row, rightColumnsToDisplay.length > 0 ? rightColumnsToDisplay : Object.keys(row));
      if (!isNull) {
        const actualIndex = actualRows.length;
        actualRows.push(row);
        actualToSynchronizedIndexMap.set(actualIndex, synchronizedIndex);
      }
    });
    
    // Use all available columns if rightColumnsToDisplay is empty or insufficient
    // This ensures duplicate detection works even when no columns are selected
    let columnsForAnalysis = rightColumnsToDisplay;
    if (columnsForAnalysis.length === 0 && actualRows.length > 0) {
      // Get all unique column keys from all rows
      const allColumns = new Set<string>();
      actualRows.forEach(row => {
        Object.keys(row).forEach(key => {
          // Exclude metadata columns
          if (!key.endsWith('_OriginalId') && !key.endsWith('_OriginalValue')) {
            allColumns.add(key);
          }
        });
      });
      columnsForAnalysis = Array.from(allColumns);
    }
    
    const quality = analyzeDataQuality(actualRows, columnsForAnalysis, {
      nameColumns: ["Oid"],
    });
    
    // Map indices from actual rows back to synchronized rows
    const remappedDuplicateGroups = quality.duplicateGroups.map(group => ({
      ...group,
      indices: group.indices.map(actualIdx => actualToSynchronizedIndexMap.get(actualIdx) ?? actualIdx),
    }));
    
    const remappedDuplicateIndexSet = new Set<number>();
    remappedDuplicateGroups.forEach(group => {
      group.indices.forEach(idx => remappedDuplicateIndexSet.add(idx));
    });
    
    const remappedNameDuplicateGroups = quality.nameDuplicateGroups.map(group => ({
      ...group,
      indices: group.indices.map(actualIdx => actualToSynchronizedIndexMap.get(actualIdx) ?? actualIdx),
    }));
    
    const remappedNameDuplicateIndexSet = new Set<number>();
    remappedNameDuplicateGroups.forEach(group => {
      group.indices.forEach(idx => remappedNameDuplicateIndexSet.add(idx));
    });
    
    return {
      ...quality,
      duplicateGroups: remappedDuplicateGroups,
      duplicateIndexSet: remappedDuplicateIndexSet,
      nameDuplicateGroups: remappedNameDuplicateGroups,
      nameDuplicateIndexSet: remappedNameDuplicateIndexSet,
    };
  }, [synchronizedRightRows, rightColumnsToDisplay]);

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
  // Note: Use synchronized rows to ensure rows with same values are at the same index
  const comparisonResult = useTableComparison({ 
    leftRows: synchronizedLeftRows || [],
    rightRows: synchronizedRightRows || [],
    columnsToCompare,
  });

  // Calculate comparison statistics
  const comparisonStats = useMemo(() => {
    // Get actual total rows from table data (not limited rows)
    const leftTotalRows = finalLeftTableData?.totalRows ?? 0;
    const rightTotalRows = finalRightTableData?.totalRows ?? 0;
    const actualTotalRows = Math.max(leftTotalRows, rightTotalRows);

    // Get rows that were actually compared
    // Use synchronized rows count (both tables now have the same number of rows)
    const leftLoadedRows = leftRowsWithCombined?.length || 0;
    const rightLoadedRows = rightRowsWithCombined?.length || 0;
    const synchronizedRowCount = Math.max(synchronizedLeftRows?.length || 0, synchronizedRightRows?.length || 0);
    
    let comparedRowsCount = 0;
    if (comparisonResult) {
      comparisonResult.forEach((result) => {
        // Count rows that were matched (same or different), not left-only or right-only
        if (result.status === "same" || result.status === "different") {
          comparedRowsCount++;
        }
      });
      // If no matches found but we have synchronized rows, use synchronized row count
      if (comparedRowsCount === 0 && synchronizedRowCount > 0) {
        comparedRowsCount = synchronizedRowCount;
      }
    } else {
      comparedRowsCount = synchronizedRowCount;
    }

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
        leftSelectedColumns: leftSelectedColumns.size,
        rightSelectedColumns: rightSelectedColumns.size,
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
    // columnsToCompare includes all columns that are displayed in both sides with the same name
    // This is the correct count for actual comparison
    const comparedColsCount = columnsToCompare.length;
    
    // Also calculate total selected columns on each side for reference
    const leftSelectedCount = leftSelectedColumns.size;
    const rightSelectedCount = rightSelectedColumns.size;

    const stats = {
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
      leftSelectedColumns: leftSelectedCount,
      rightSelectedColumns: rightSelectedCount,
      leftTotalRows,
      rightTotalRows,
    };

    // Log detailed comparison statistics
    if (flowLog && open) {
      const samePercentage = comparedRowsCount > 0 ? ((sameRows / comparedRowsCount) * 100).toFixed(2) : '0.00';
      const differentPercentage = comparedRowsCount > 0 ? ((differentRows / comparedRowsCount) * 100).toFixed(2) : '0.00';
      const leftOnlyPercentage = comparedRowsCount > 0 ? ((leftOnlyRows / comparedRowsCount) * 100).toFixed(2) : '0.00';
      const rightOnlyPercentage = comparedRowsCount > 0 ? ((rightOnlyRows / comparedRowsCount) * 100).toFixed(2) : '0.00';
      
      flowLog.info('Tổng kết so sánh 2 bảng', {
        thongTinBang: {
          trai: {
            database: leftTable.databaseName,
            schema: leftTable.schemaName,
            table: leftTable.tableName,
            totalRows: leftTotalRows,
            loadedRows: leftLoadedRows,
            columns: leftTableData?.columns?.length || 0,
            selectedColumns: leftSelectedCount,
          },
          phai: {
            database: rightTable.databaseName,
            schema: rightTable.schemaName,
            table: rightTable.tableName,
            totalRows: rightTotalRows,
            loadedRows: rightLoadedRows,
            columns: rightTableData?.columns?.length || 0,
            selectedColumns: rightSelectedCount,
          },
        },
        thongKeSoSanh: {
          tongSoRowsThucTe: actualTotalRows,
          rowsDaSoSanh: comparedRowsCount,
          rowsGiongNhau: sameRows,
          rowsKhacNhau: differentRows,
          chiCoBenTrai: leftOnlyRows,
          chiCoBenPhai: rightOnlyRows,
        },
        tyLe: {
          giongNhau: `${samePercentage}%`,
          khacNhau: `${differentPercentage}%`,
          chiCoMotBen: `${(parseFloat(leftOnlyPercentage) + parseFloat(rightOnlyPercentage)).toFixed(2)}%`,
          chiCoBenTrai: `${leftOnlyPercentage}%`,
          chiCoBenPhai: `${rightOnlyPercentage}%`,
        },
        columns: {
          columnsSoSanh: columnsToCompare.length,
          columnsSoSanhList: columnsToCompare.sort(),
          columnsDaChonTrai: leftSelectedCount,
          columnsDaChonPhai: rightSelectedCount,
          tongColumns: stats.totalColumns,
        },
        cauHinh: {
          combinedColumns: validatedCombinedColumns.length,
          activeFilters: {
            trai: leftTableFilters.activeFilterCount,
            phai: rightTableFilters.activeFilterCount,
            tong: leftTableFilters.activeFilterCount + rightTableFilters.activeFilterCount,
          },
          includeReferences,
          leftLimit,
          rightLimit,
        },
        chiTietSoSanh: {
          leftLoadedRows,
          rightLoadedRows,
          comparisonResultSize: comparisonResult?.size || 0,
          hasComparisonResult: !!comparisonResult,
        },
      });
    }

    return stats;
  }, [
    comparisonResult,
    leftRowsWithCombined,
    rightRowsWithCombined,
    synchronizedLeftRows,
    synchronizedRightRows,
    leftTableData,
    rightTableData,
    columnsToCompare,
    leftSelectedColumns,
    rightSelectedColumns,
    finalLeftTableData?.totalRows,
    finalRightTableData?.totalRows,
    flowLog,
    open,
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    validatedCombinedColumns.length,
    leftTableFilters.activeFilterCount,
    rightTableFilters.activeFilterCount,
    includeReferences,
    leftLimit,
    rightLimit,
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
                      onColumnPrioritiesChange={setLeftColumnPriorities}
                      onSortOrderChange={setLeftSortOrder}
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
                  rows={synchronizedLeftRows || []}
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
                      onColumnPrioritiesChange={setRightColumnPriorities}
                      onSortOrderChange={setRightSortOrder}
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
                  rows={synchronizedRightRows || []}
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
                    <span className="text-sm text-muted-foreground">Columns so sánh (cùng tên)</span>
                    <Badge variant="secondary">{comparisonStats.comparedColumns}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Columns đã chọn (trái)</span>
                    <Badge variant="outline">{comparisonStats.leftSelectedColumns ?? 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Columns đã chọn (phải)</span>
                    <Badge variant="outline">{comparisonStats.rightSelectedColumns ?? 0}</Badge>
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
                  <div className="text-xs font-medium mb-2">Columns được so sánh (cùng tên)</div>
                  {columnsToCompare.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        {columnsToCompare.length} columns có cùng tên ở cả hai bảng:
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
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground italic">
                        Không có columns nào có cùng tên ở cả hai bảng để so sánh
                      </div>
                      {(comparisonStats.leftSelectedColumns ?? 0) > 0 || (comparisonStats.rightSelectedColumns ?? 0) > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          <div>Columns đã chọn bên trái: {comparisonStats.leftSelectedColumns ?? 0}</div>
                          <div>Columns đã chọn bên phải: {comparisonStats.rightSelectedColumns ?? 0}</div>
                          <div className="mt-1 text-amber-600 dark:text-amber-400">
                            💡 Để so sánh, cần có columns có cùng tên ở cả hai bảng hoặc sử dụng combined columns
                          </div>
                        </div>
                      ) : null}
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

