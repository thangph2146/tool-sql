"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Database,
  Filter,
  XCircle,
  Link2,
} from "lucide-react";
import type { DatabaseName } from "@/lib/db-config";
import {
  useTableData,
  useTableRelationships,
} from "@/lib/hooks/use-database-query";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import {
  TABLE_LIMIT_OPTIONS,
  DEFAULT_TABLE_LIMIT,
} from "@/lib/constants/table-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { filterHiddenColumns } from "@/lib/utils/table-column-utils";
import { analyzeDataQuality } from "@/lib/utils/data-quality-utils";
import { sortRelationships } from "@/lib/utils/relationship-utils";
import { useFlowLoggerWithKey } from "@/lib/hooks/use-flow-logger";
import { FLOW_NAMES } from "@/lib/constants/flow-constants";
import { DataQualityAlert, TableRelationshipsDialog } from "../shared";
import { DataTable } from "./data-table";

interface TableDataViewProps {
  databaseName: DatabaseName;
  schemaName: string;
  tableName: string;
  onClose?: () => void;
  onTableChange?: (schema: string, table: string) => void;
  onError?: (schema: string, table: string, error: Error | unknown) => void;
}

export function TableDataView({
  databaseName,
  schemaName,
  tableName,
  onTableChange,
  onError,
}: TableDataViewProps) {
  const [limit, setLimit] = useState(DEFAULT_TABLE_LIMIT);
  const [includeReferences, setIncludeReferences] = useState(true);

  // Flow logging with key-based lifecycle
  const tableKey = `${databaseName}_${schemaName}_${tableName}`;
  const { flowLog } = useFlowLoggerWithKey(
    tableKey,
    () => FLOW_NAMES.TABLE_DATA_VIEW(databaseName, schemaName, tableName),
    () => ({
      database: databaseName,
      schema: schemaName,
      table: tableName,
      includeReferences,
      limit,
    })
  );

  // Log when view opens
  useEffect(() => {
    if (flowLog) {
      flowLog.info('TableDataView opened', {
        database: databaseName,
        schema: schemaName,
        table: tableName,
      });
    }
  }, [flowLog, databaseName, schemaName, tableName]);

  // Fetch relationships (fallback if not included in table data)
  // Only fetch if includeReferences is false (when relationships are not in tableData)
  const { data: relationshipsData } = useTableRelationships(
    databaseName,
    schemaName,
    tableName,
    !includeReferences // Only enable if relationships are NOT included in table data
  );

  // Filter state (used to drive API filters)
  const {
    filters,
    debouncedFilters,
    showFilters,
    setShowFilters,
    hasActiveFilters,
    activeFilterCount,
    handleFilterChange: baseHandleFilterChange,
    handleClearFilters: baseHandleClearFilters,
    handleClearFilter: baseHandleClearFilter,
  } = useTableFilters();

  // Fetch data with pagination (server-side filters)
  // This single call provides both the data and totalRows
  // Start with offset 0, pagination will update when user navigates
  const { data, isLoading, error } = useTableData(
    databaseName,
    schemaName,
    tableName,
    limit,
    0, // Start with offset 0
    true,
    includeReferences,
    debouncedFilters
  );

  const tableData = data?.data;
  
  // Get totalRows from response (defaults to 0 if not available yet)
  // Pagination hook can handle totalRows = 0 initially
  const totalRows = tableData?.totalRows || 0;

  // Use pagination hook (totalRows will update when tableData loads)
  const pagination = useTablePagination({
    totalRows,
    limit,
    onLimitChange: useCallback((newLimit: number) => {
      setLimit(newLimit);
    }, []),
  });

  // Fetch data with pagination when offset changes (only if offset > 0 to avoid duplicate call)
  const { data: paginatedData, isLoading: isPaginatedLoading, error: paginatedError } = useTableData(
    databaseName,
    schemaName,
    tableName,
    limit,
    pagination.offset,
    pagination.offset > 0, // Only fetch if offset > 0 (avoid duplicate call when offset = 0)
    includeReferences,
    debouncedFilters
  );

  // Use paginated data if offset > 0, otherwise use initial data
  const finalTableData = pagination.offset > 0 ? paginatedData?.data : tableData;
  const finalIsLoading = pagination.offset > 0 ? isPaginatedLoading : isLoading;
  const finalError = pagination.offset > 0 ? paginatedError : error;
  
  // Merge relationships: prefer from finalTableData (when includeReferences=true), fallback to relationshipsData
  const relationships = useMemo(() => {
    // If includeReferences is true, relationships should come from finalTableData
    if (includeReferences && finalTableData?.relationships && Array.isArray(finalTableData.relationships)) {
      return sortRelationships(finalTableData.relationships);
    }
    // Otherwise, use relationships from useTableRelationships hook
    const rels = relationshipsData?.data?.relationships || [];
    return sortRelationships(rels);
  }, [includeReferences, finalTableData, relationshipsData?.data?.relationships]);
  const tableRows = useMemo(
    () => (finalTableData?.rows ? [...finalTableData.rows] : []),
    [finalTableData]
  );
  const filteredRowCount = finalTableData?.filteredRowCount ?? tableRows.length;

  const visibleColumns = useMemo(() => {
    if (!finalTableData?.columns || !Array.isArray(finalTableData.columns)) return [];
    return filterHiddenColumns(finalTableData.columns);
  }, [finalTableData]);

  const dataQuality = useMemo(
    () =>
      analyzeDataQuality(tableRows, visibleColumns, {
        nameColumns: ["Oid"],
      }),
    [tableRows, visibleColumns]
  );
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScrollToRow = useCallback((index: number) => {
    const rowEl = rowRefs.current[index];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedRow(index);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedRow(null);
      }, 2000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Log when table data is loaded
  useEffect(() => {
    if (finalTableData && flowLog) {
      // Log detailed table data information
      const columnNames = finalTableData.columns.map((col) => String(col));
      const sampleRows = finalTableData.rows.slice(0, 3).map((row) => {
        const sample: Record<string, unknown> = {};
        columnNames.slice(0, 5).forEach((col) => {
          const value = row[col];
          if (value !== null && value !== undefined) {
            const strValue = String(value);
            sample[col] =
              strValue.length > 50
                ? strValue.substring(0, 50) + "..."
                : strValue;
          } else {
            sample[col] = null;
          }
        });
        return sample;
      });

      flowLog.success("Table data loaded", {
        rowsLoaded: finalTableData.rows.length,
        totalRows: finalTableData.totalRows,
        columns: {
          count: finalTableData.columns.length,
          names: columnNames,
        },
        offset: pagination.offset,
        limit,
        includeReferences,
        hasMore: finalTableData.hasMore,
        sampleRows: sampleRows.length > 0 ? sampleRows : null,
        relationshipsCount: relationships.length,
      });

      // Log additional info about data
      if (finalTableData.rows.length > 0) {
        flowLog.info("Table data details", {
          firstRowKeys: Object.keys(finalTableData.rows[0]),
          dataTypes: columnNames.slice(0, 10).map((col) => {
            const firstValue = finalTableData.rows[0]?.[col];
            return {
              column: col,
              type:
                firstValue !== null && firstValue !== undefined
                  ? typeof firstValue
                  : "null",
              sampleValue:
                firstValue !== null && firstValue !== undefined
                  ? String(firstValue).length > 30
                    ? String(firstValue).substring(0, 30) + "..."
                    : String(firstValue)
                  : null,
            };
          }),
        });
      }
    }
  }, [
    finalTableData,
    pagination.offset,
    limit,
    includeReferences,
    relationships.length,
    flowLog,
  ]);

  // Log errors - only log when component is mounted and error is new
  const errorLoggedRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      errorLoggedRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Only log error if component is mounted and error is new
    if (finalError && flowLog && isMountedRef.current) {
      // Create a unique key for this error to avoid logging the same error multiple times
      const errorKey = finalError instanceof Error 
        ? `${finalError.message}-${finalError.stack?.substring(0, 50)}` 
        : String(finalError);
      
      // Only log if this is a new error (different from the last logged one)
      if (errorLoggedRef.current !== errorKey) {
        errorLoggedRef.current = errorKey;
        flowLog.error("Error loading table data", finalError);
        // Notify parent component about the error
        if (onError) {
          onError(schemaName, tableName, finalError);
        }
      }
    } else if (!finalError && isMountedRef.current) {
      // Reset error log tracking when error is cleared
      errorLoggedRef.current = null;
    }
  }, [finalError, flowLog, schemaName, tableName, onError]);

  // Create a debounced filter key for forcing re-render when debounced filters change
  const debouncedFilterKey = useMemo(() => {
    const activeFilters = Object.entries(debouncedFilters)
      .filter(([, v]) => v?.trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([col, val]) => `${col}:${val}`)
      .join("|");
    return activeFilters || "no-filters";
  }, [debouncedFilters]);

  // Log when filtered rows change (from API response)
  useEffect(() => {
    if (flowLog && finalTableData) {
      const activeFiltersList = Object.entries(debouncedFilters)
        .filter(([, v]) => v?.trim() !== "")
        .map(([col, val]) => ({ column: col, value: val }));
      flowLog.debug("Filtered rows updated", {
        filteredCount: finalTableData?.rows.length || 0,
        totalRows: finalTableData?.totalRows || 0,
        filteredRowCount: finalTableData?.filteredRowCount ?? finalTableData?.rows.length ?? 0,
        hasActiveFilters,
        activeFilterCount,
        activeFilters: activeFiltersList,
        filters: Object.entries(filters)
          .filter(([, v]) => v?.trim() !== "")
          .map(([col, val]) => ({ column: col, value: val })),
      });
    }
  }, [
    finalTableData,
    debouncedFilters,
    filters,
    hasActiveFilters,
    activeFilterCount,
    flowLog,
  ]);

  // Enhanced filter handlers that reset pagination - memoized with useCallback
  const handleFilterChange = useCallback(
    (column: string, value: string) => {
      flowLog?.debug(
        `Table data filter changed: ${schemaName}.${tableName}`,
        {
          database: databaseName,
          schema: schemaName,
          table: tableName,
          column,
          value,
          resetPage: true,
        }
      );
      baseHandleFilterChange(column, value);
      pagination.setPage(0);
    },
    [baseHandleFilterChange, pagination, databaseName, schemaName, tableName, flowLog]
  );

  const handleClearFilters = useCallback(() => {
    flowLog?.info(
      `Cleared all filters for table: ${schemaName}.${tableName}`,
      {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        activeFilterCount,
      }
    );
    baseHandleClearFilters();
    pagination.setPage(0);
  }, [
    baseHandleClearFilters,
    pagination,
    databaseName,
    schemaName,
    tableName,
    activeFilterCount,
    flowLog,
  ]);

  const handleClearFilter = useCallback(
    (column: string) => {
      flowLog?.debug(
        `Cleared filter for column: ${column} in table: ${schemaName}.${tableName}`,
        {
          database: databaseName,
          schema: schemaName,
          table: tableName,
          column,
        }
      );
      baseHandleClearFilter(column);
      pagination.setPage(0);
    },
    [baseHandleClearFilter, pagination, databaseName, schemaName, tableName, flowLog]
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4 pt-8 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {schemaName}.{tableName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Database: {databaseName}
              {finalTableData && (
                <span className="ml-2">
                  • {visibleColumns.length} columns
                </span>
              )}
              {relationships.length > 0 && (
                <span className="ml-2">
                  • {relationships.length} relationship
                  {relationships.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {relationships.length > 0 && (
            <TableRelationshipsDialog
              relationships={relationships}
              schemaName={schemaName}
              tableName={tableName}
              onTableChange={onTableChange}
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Relationships</span>
                  <Badge variant="secondary" className="ml-1">
                    {relationships.length}
                  </Badge>
                </Button>
              }
            />
          )}
          <Field orientation="horizontal" className="gap-2 items-center">
            <FieldLabel
              className="text-xs cursor-pointer"
              onClick={() => setIncludeReferences(!includeReferences)}
            >
              Show References
            </FieldLabel>
            <FieldContent>
              <input
                type="checkbox"
                checked={includeReferences}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  if (flowLog) {
                    flowLog.info("Include references toggled", {
                      includeReferences: newValue,
                      previousValue: includeReferences,
                    });
                  }
                  setIncludeReferences(newValue);
                }}
                className="h-4 w-4 rounded border-input"
              />
            </FieldContent>
          </Field>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 max-h-full">
        {finalIsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading table data...
            </span>
          </div>
        ) : finalError ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Database className="h-12 w-12 text-destructive mb-4 opacity-50" />
            <p className="text-sm font-medium text-foreground mb-2">
              Error loading table data
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {finalError instanceof Error
                ? finalError.message
                : "Unknown error occurred"}
            </p>
          </div>
        ) : finalTableData ? (
          <>
            {/* Filter Controls */}
            <div className="border-b border-border p-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newShowFilters = !showFilters;
                    flowLog?.debug(
                      `${
                        newShowFilters ? "Showing" : "Hiding"
                      } filters for table: ${schemaName}.${tableName}`,
                      {
                        database: databaseName,
                        schema: schemaName,
                        table: tableName,
                        showFilters: newShowFilters,
                        activeFilterCount,
                      }
                    );
                    setShowFilters(newShowFilters);
                  }}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
                <DataQualityAlert
                  duplicateGroups={dataQuality.duplicateGroups}
                  duplicateIndexSet={dataQuality.duplicateIndexSet}
                  nameDuplicateGroups={dataQuality.nameDuplicateGroups}
                  nameDuplicateIndexSet={dataQuality.nameDuplicateIndexSet}
                  redundantColumns={dataQuality.redundantColumns}
                  onRowNavigate={handleScrollToRow}
                />
              </div>
              {hasActiveFilters && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  <XCircle className="h-3 w-3" />
                  Clear All Filters
                </Button>
              )}
            </div>

            <DataTable
              columns={visibleColumns}
              rows={tableRows}
              filters={filters}
              showFilters={showFilters}
              relationships={relationships}
              includeReferences={includeReferences}
              databaseName={databaseName}
              schemaName={schemaName}
              tableName={tableName}
              onFilterChange={handleFilterChange}
              onClearFilter={handleClearFilter}
              hasActiveFilters={hasActiveFilters}
              duplicateIndexSet={dataQuality.duplicateIndexSet}
              nameDuplicateIndexSet={dataQuality.nameDuplicateIndexSet}
              highlightedRow={highlightedRow}
              rowRefs={rowRefs}
              debouncedFilterKey={debouncedFilterKey}
              containerClassName="h-full min-h-[300px] max-h-[500px] max-w-[85vw] px-4"
              style={{ height: "100%", maxHeight: "100%" }}
            />

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-t border-border">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  {hasActiveFilters ? (
                    <>
                      Showing {filteredRowCount} of {totalRows} rows
                      {filteredRowCount !== totalRows && (
                        <span className="text-primary"> (filtered)</span>
                      )}
                      <span className="ml-1">
                        ({finalTableData?.columns.length || 0} columns)
                      </span>
                    </>
                  ) : (
                    <>
                      Showing {pagination.offset + 1} -{" "}
                      {Math.min(pagination.offset + limit, totalRows)} of{" "}
                      {totalRows} rows ({finalTableData?.columns.length || 0} columns)
                    </>
                  )}
                </div>
                <Field orientation="horizontal" className="gap-2">
                  <FieldLabel className="text-xs">Rows per page:</FieldLabel>
                  <FieldContent>
                    <select
                      value={limit}
                      onChange={pagination.handleLimitChange}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {TABLE_LIMIT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </FieldContent>
                </Field>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pagination.handleFirstPage}
                  disabled={pagination.page === 0}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pagination.handlePrevious}
                  disabled={pagination.page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Page</span>
                  <Input
                    type="number"
                    min={1}
                    max={pagination.totalPages || 1}
                    value={pagination.pageInput}
                    onChange={(e) =>
                      pagination.handlePageInputChange(e.target.value)
                    }
                    onBlur={pagination.handlePageInputSubmit}
                    onKeyDown={pagination.handlePageInputKeyDown}
                    className="h-8 w-16 text-center text-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    of {pagination.totalPages || 1}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pagination.handleNext}
                  disabled={!finalTableData?.hasMore}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pagination.handleLastPage}
                  disabled={
                    !finalTableData?.hasMore ||
                    pagination.currentPage >= pagination.totalPages
                  }
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

