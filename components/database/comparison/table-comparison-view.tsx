"use client";

import { useState, useMemo, useEffect } from "react";
import { GitCompare } from "lucide-react";
import type { DatabaseName } from "@/lib/db-config";
import { useTableData, useTableRelationships } from "@/lib/hooks/use-database-query";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import { useTableComparison } from "@/lib/hooks/use-table-comparison";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { ComparisonTable } from "./comparison-table";
import { ComparisonLoadingState } from "./comparison-loading-state";
import { ComparisonStatsBar } from "./comparison-stats-bar";
import { DEFAULT_TABLE_LIMIT } from "@/lib/constants/table-constants";
import { getColumnsToDisplay } from "@/lib/utils/table-column-utils";
import { sortRelationships } from "@/lib/utils/relationship-utils";
import { analyzeDataQuality } from "@/lib/utils/data-quality-utils";
import { useFlowLoggerWithKey } from "@/lib/hooks/use-flow-logger";
import { FLOW_NAMES } from "@/lib/constants/flow-constants";
import { useSyncedColumns } from "@/lib/hooks/use-synced-columns";

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
  const [limit] = useState(DEFAULT_TABLE_LIMIT);
  const [page] = useState(0);
  const [showColumnSelector] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [includeReferences, setIncludeReferences] = useState(true);
  const offset = page * limit;

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
      limit,
      page,
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

  // Fetch data for both tables
  const leftData = useTableData(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    limit,
    offset,
    open, // Only fetch when dialog/view is open
    includeReferences,
    leftTableFilters.debouncedFilters
  );

  const rightData = useTableData(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    limit,
    offset,
    open, // Only fetch when dialog/view is open
    includeReferences,
    rightTableFilters.debouncedFilters
  );

  const leftTableData = leftData.data?.data;
  const rightTableData = rightData.data?.data;

  // Log when table data is loaded
  useEffect(() => {
    if (leftTableData && rightTableData && flowLog) {
      flowLog.success('Comparison data loaded', {
        leftTable: {
          rowsLoaded: leftTableData.rows.length,
          totalRows: leftTableData.totalRows,
          columns: leftTableData.columns.length,
        },
        rightTable: {
          rowsLoaded: rightTableData.rows.length,
          totalRows: rightTableData.totalRows,
          columns: rightTableData.columns.length,
        },
        offset,
        limit,
        includeReferences,
      });
    }
  }, [leftTableData, rightTableData, offset, limit, includeReferences, flowLog]);

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

  // Get all unique columns from both tables
  const allColumns = useMemo(() => {
    const leftCols = (leftTableData?.columns || []).map(c => String(c).trim());
    const rightCols = (rightTableData?.columns || []).map(c => String(c).trim());
    const uniqueCols = new Set([...leftCols, ...rightCols]);
    return Array.from(uniqueCols).sort();
  }, [leftTableData?.columns, rightTableData?.columns]);


  // Manage selected columns with automatic sync from allColumns
  const [selectedColumns] = useSyncedColumns(allColumns);

  // Get columns to compare (only selected ones)
  const columnsToCompare = useMemo(() => {
    return allColumns.filter(col => selectedColumns.has(col));
  }, [allColumns, selectedColumns]);

  // Get columns to display using utility function
  const leftColumnsToDisplay = useMemo(() => {
    if (!leftTableData?.columns) return [];
    if (selectedColumns.size === 0) {
      return leftTableData.columns.map(c => String(c));
    }
    return getColumnsToDisplay(leftTableData.columns, selectedColumns);
  }, [selectedColumns, leftTableData]);

  const rightColumnsToDisplay = useMemo(() => {
    if (!rightTableData?.columns) return [];
    if (selectedColumns.size === 0) {
      return rightTableData.columns.map(c => String(c));
    }
    return getColumnsToDisplay(rightTableData.columns, selectedColumns);
  }, [selectedColumns, rightTableData]);

  const leftDataQuality = useMemo(
    () =>
      analyzeDataQuality(leftTableData?.rows || [], leftColumnsToDisplay, {
        nameColumns: ["Oid"],
      }),
    [leftTableData?.rows, leftColumnsToDisplay]
  );

  const rightDataQuality = useMemo(
    () =>
      analyzeDataQuality(rightTableData?.rows || [], rightColumnsToDisplay, {
        nameColumns: ["Oid"],
      }),
    [rightTableData?.rows, rightColumnsToDisplay]
  );

  // Compare rows using optimized hook
  const comparisonResult = useTableComparison({ 
    leftRows: leftTableData?.rows || [],
    rightRows: rightTableData?.rows || [],
    columnsToCompare,
  });

  // Memoize computed values for performance
  const isLoading = useMemo(() => leftData.isLoading || rightData.isLoading, [leftData.isLoading, rightData.isLoading]);
  const hasError = useMemo(() => leftData.error || rightData.error, [leftData.error, rightData.error]);
  
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
  
  // Memoize difference count
  const differenceCount = useMemo(
    () => comparisonResult ? Array.from(comparisonResult.values()).filter((d) => d.status !== "same").length : 0,
    [comparisonResult]
  );


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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <ComparisonLoadingState
          isLoading={isLoading}
          loadingStates={{
            leftData: leftData.isLoading,
            rightData: rightData.isLoading,
            leftRelationships: leftRelationshipsData?.isLoading ?? false,
            rightRelationships: rightRelationshipsData?.isLoading ?? false,
          }}
          hasError={!!hasError}
          errors={{
            leftData: leftData.error,
            rightData: rightData.error,
            leftRelationships: leftRelationshipsData?.error,
            rightRelationships: rightRelationshipsData?.error,
          }}
        />
        {!isLoading && !hasError && leftTableData && rightTableData ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Comparison Stats */}
            <ComparisonStatsBar
              leftTable={leftTable}
              rightTable={rightTable}
              leftTableData={leftTableData}
              rightTableData={rightTableData}
              differenceCount={differenceCount}
              columnsToCompare={columnsToCompare}
              allColumns={allColumns}
              leftRelationships={leftRelationships}
              rightRelationships={rightRelationships}
              leftDataQuality={leftDataQuality}
              rightDataQuality={rightDataQuality}
            />

            {/* Side by Side Tables */}
            <div className="flex-1 grid grid-cols-2 gap-0 min-h-0 overflow-hidden">
              {/* Left Table */}
              <div className="flex flex-col border-r border-border min-h-0">
                <ComparisonTable
                  databaseName={leftTable.databaseName}
                  schemaName={leftTable.schemaName}
                  tableName={leftTable.tableName}
                  columns={leftColumnsToDisplay}
                  rows={leftTableData.rows}
                  filters={leftTableFilters}
                  showFilters={showFilters}
                  onToggleFilters={() => setShowFilters(!showFilters)}
                  activeFilterCount={leftActiveFilterCount}
                  comparisonResult={comparisonResult}
                  side="left"
                  relationships={leftRelationships}
                  includeReferences={includeReferences}
                  totalRows={leftTableData.totalRows}
                  filteredRowCount={leftTableData.filteredRowCount}
                  onTableChange={onTableChange ? (schema, table) => onTableChange(leftTable.databaseName, schema, table) : undefined}
                  duplicateGroups={leftDataQuality.duplicateGroups}
                  duplicateIndexSet={leftDataQuality.duplicateIndexSet}
                  redundantColumns={leftDataQuality.redundantColumns}
                  nameDuplicateGroups={leftDataQuality.nameDuplicateGroups}
                  nameDuplicateIndexSet={leftDataQuality.nameDuplicateIndexSet}
                  containerClassName={cn(
                    "h-full w-full mx-auto px-4",
                    showColumnSelector ? "max-h-[calc(100vh-600px)]" : "max-h-[500px]"
                  )}
                />
              </div>

              {/* Right Table */}
              <div className="flex flex-col border-l border-border min-h-0">
                <ComparisonTable
                  databaseName={rightTable.databaseName}
                  schemaName={rightTable.schemaName}
                  tableName={rightTable.tableName}
                  columns={rightColumnsToDisplay}
                  rows={rightTableData.rows}
                  filters={rightTableFilters}
                  showFilters={showFilters}
                  onToggleFilters={() => setShowFilters(!showFilters)}
                  activeFilterCount={rightActiveFilterCount}
                  comparisonResult={comparisonResult}
                  side="right"
                  relationships={rightRelationships}
                  includeReferences={includeReferences}
                  totalRows={rightTableData.totalRows}
                  filteredRowCount={rightTableData.filteredRowCount}
                  onTableChange={onTableChange ? (schema, table) => onTableChange(rightTable.databaseName, schema, table) : undefined}
                  duplicateGroups={rightDataQuality.duplicateGroups}
                  duplicateIndexSet={rightDataQuality.duplicateIndexSet}
                  redundantColumns={rightDataQuality.redundantColumns}
                  nameDuplicateGroups={rightDataQuality.nameDuplicateGroups}
                  nameDuplicateIndexSet={rightDataQuality.nameDuplicateIndexSet}
                  containerClassName={cn(
                    "h-full w-full mx-auto px-4",
                    showColumnSelector ? "min-h-[calc(100vh-600px)] max-h-[calc(100vh-600px)]" : "min-h-[500px] max-h-[500px]"
                  )}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
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

