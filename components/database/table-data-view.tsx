"use client";

import { useState, useCallback, useMemo } from "react";
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
import { TableCell as TableCellComponent } from "@/components/database/table-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupButton,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import {
  normalizeColumnName,
  filterHiddenColumns,
} from "@/lib/utils/table-column-utils";
import { logger } from "@/lib/logger";
import { useEffect, useRef } from "react";
import { ReferenceColumnFilter } from "@/components/database/reference-column-filter";

interface TableDataViewProps {
  databaseName: DatabaseName;
  schemaName: string;
  tableName: string;
  onClose?: () => void;
}

export function TableDataView({
  databaseName,
  schemaName,
  tableName,
}: TableDataViewProps) {
  const [limit, setLimit] = useState(DEFAULT_TABLE_LIMIT);
  const [includeReferences, setIncludeReferences] = useState(true);
  const [showRelationshipsDialog, setShowRelationshipsDialog] = useState(false);

  // Flow logging for TableDataView
  const flowLogRef = useRef<ReturnType<typeof logger.createFlowLogger> | null>(
    null
  );
  const currentTableKey = useRef<string>("");

  // Initialize flow when component mounts or table changes
  useEffect(() => {
    const tableKey = `${databaseName}_${schemaName}_${tableName}`;

    // End previous flow if table changed
    if (
      currentTableKey.current &&
      currentTableKey.current !== tableKey &&
      flowLogRef.current
    ) {
      flowLogRef.current.end(true, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
      });
      flowLogRef.current = null;
    }

    // Create new flow if not exists or table changed
    if (!flowLogRef.current || currentTableKey.current !== tableKey) {
      const flowName = `TABLE_DATA_VIEW_${databaseName.toUpperCase()}_${schemaName}_${tableName}`;
      const flowId = logger.startFlow(flowName, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        includeReferences,
        limit,
      });
      flowLogRef.current = logger.createFlowLogger(flowId);
      currentTableKey.current = tableKey;

      flowLogRef.current.info("TableDataView opened", {
        database: databaseName,
        schema: schemaName,
        table: tableName,
      });
    }

    // Cleanup: end flow when component unmounts or table changes
    // Note: In React Strict Mode (development), cleanup runs twice, but we check currentTableKey
    // to ensure we only end flow when table actually changes or component really unmounts
    return () => {
      // Only end flow if this is still the current table
      // In Strict Mode, if component remounts immediately, currentTableKey will be set again
      // so this check will fail and flow won't be ended prematurely
      if (flowLogRef.current && currentTableKey.current === tableKey) {
        // Use a flag to prevent ending flow if component remounts (Strict Mode)
        const shouldEndFlow = currentTableKey.current === tableKey;

        if (shouldEndFlow) {
          flowLogRef.current.end(true, {
            database: databaseName,
            schema: schemaName,
            table: tableName,
            reason: "Component unmounted or table changed",
          });
          flowLogRef.current = null;
          // Only clear currentTableKey if it's still the same (real unmount)
          if (currentTableKey.current === tableKey) {
            currentTableKey.current = "";
          }
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseName, schemaName, tableName]); // Only recreate flow when table changes, not when includeReferences/limit change

  // Fetch relationships
  const { data: relationshipsData } = useTableRelationships(
    databaseName,
    schemaName,
    tableName,
    true
  );

  const relationships = useMemo(() => {
    return relationshipsData?.data?.relationships || [];
  }, [relationshipsData?.data?.relationships]);

  // Fetch initial data to get totalRows (minimal fetch)
  const { data: initialData } = useTableData(
    databaseName,
    schemaName,
    tableName,
    1,
    0,
    true,
    includeReferences
  );

  const totalRows = initialData?.data?.totalRows || 0;

  // Use pagination hook
  const pagination = useTablePagination({
    totalRows,
    limit,
    onLimitChange: useCallback((newLimit: number) => {
      setLimit(newLimit);
    }, []),
  });

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
  const { data, isLoading, error } = useTableData(
    databaseName,
    schemaName,
    tableName,
    limit,
    pagination.offset,
    true,
    includeReferences,
    debouncedFilters
  );

  const tableData = data?.data;
  const tableRows = tableData?.rows ?? [];
  const filteredRowCount = tableData?.filteredRowCount ?? tableRows.length;

  // Log when table data is loaded
  useEffect(() => {
    if (tableData && flowLogRef.current) {
      // Log detailed table data information
      const columnNames = tableData.columns.map((col) => String(col));
      const sampleRows = tableData.rows.slice(0, 3).map((row) => {
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

      flowLogRef.current.success("Table data loaded", {
        rowsLoaded: tableData.rows.length,
        totalRows: tableData.totalRows,
        columns: {
          count: tableData.columns.length,
          names: columnNames,
        },
        offset: pagination.offset,
        limit,
        includeReferences,
        hasMore: tableData.hasMore,
        sampleRows: sampleRows.length > 0 ? sampleRows : null,
        relationshipsCount: relationships.length,
      });

      // Log additional info about data
      if (tableData.rows.length > 0) {
        flowLogRef.current.info("Table data details", {
          firstRowKeys: Object.keys(tableData.rows[0]),
          dataTypes: columnNames.slice(0, 10).map((col) => {
            const firstValue = tableData.rows[0]?.[col];
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
    tableData,
    pagination.offset,
    limit,
    includeReferences,
    relationships.length,
  ]);

  // Log errors
  useEffect(() => {
    if (error && flowLogRef.current) {
      flowLogRef.current.error("Error loading table data", error);
    }
  }, [error]);

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
    if (flowLogRef.current && tableData) {
      const activeFiltersList = Object.entries(debouncedFilters)
        .filter(([, v]) => v?.trim() !== "")
        .map(([col, val]) => ({ column: col, value: val }));
      flowLogRef.current.debug("Filtered rows updated", {
        filteredCount: tableData.rows.length,
        totalRows: tableData.totalRows,
        filteredRowCount: tableData.filteredRowCount ?? tableData.rows.length,
        hasActiveFilters,
        activeFilterCount,
        activeFilters: activeFiltersList,
        filters: Object.entries(filters)
          .filter(([, v]) => v?.trim() !== "")
          .map(([col, val]) => ({ column: col, value: val })),
      });
    }
  }, [
    tableData,
    debouncedFilters,
    filters,
    hasActiveFilters,
    activeFilterCount,
  ]);

  // Enhanced filter handlers that reset pagination - memoized with useCallback
  const handleFilterChange = useCallback(
    (column: string, value: string) => {
      logger.debug(
        `Table data filter changed: ${schemaName}.${tableName}`,
        {
          database: databaseName,
          schema: schemaName,
          table: tableName,
          column,
          value,
          resetPage: true,
        },
        "TABLE_DATA_FILTER"
      );
      baseHandleFilterChange(column, value);
      pagination.setPage(0);
    },
    [baseHandleFilterChange, pagination, databaseName, schemaName, tableName]
  );

  const handleClearFilters = useCallback(() => {
    logger.info(
      `Cleared all filters for table: ${schemaName}.${tableName}`,
      {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        activeFilterCount,
      },
      "TABLE_DATA_FILTER"
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
  ]);

  const handleClearFilter = useCallback(
    (column: string) => {
      logger.debug(
        `Cleared filter for column: ${column} in table: ${schemaName}.${tableName}`,
        {
          database: databaseName,
          schema: schemaName,
          table: tableName,
          column,
        },
        "TABLE_DATA_FILTER"
      );
      baseHandleClearFilter(column);
      pagination.setPage(0);
    },
    [baseHandleClearFilter, pagination, databaseName, schemaName, tableName]
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
              {tableData && (
                <span className="ml-2">
                  • {tableData.columns.length} columns
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
            <Dialog
              open={showRelationshipsDialog}
              onOpenChange={setShowRelationshipsDialog}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Relationships</span>
                  <Badge variant="secondary" className="ml-1">
                    {relationships.length}
                  </Badge>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Table Relationships</DialogTitle>
                  <DialogDescription>
                    Foreign key relationships for {schemaName}.{tableName}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] overflow-y-auto">
                  <div className="space-y-4">
                    {relationships.map((rel, index) => (
                      <div
                        key={index}
                        className="p-4 border border-border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-start gap-3">
                          <Link2 className="h-5 w-5 text-primary mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {rel.FK_NAME}
                              </span>
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  From:
                                </span>
                                <Badge variant="outline">
                                  {rel.FK_SCHEMA}.{rel.FK_TABLE}.{rel.FK_COLUMN}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  To:
                                </span>
                                <Badge variant="outline">
                                  {rel.PK_SCHEMA}.{rel.PK_TABLE}.{rel.PK_COLUMN}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
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
                  if (flowLogRef.current) {
                    flowLogRef.current.info("Include references toggled", {
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading table data...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Database className="h-12 w-12 text-destructive mb-4 opacity-50" />
            <p className="text-sm font-medium text-foreground mb-2">
              Error loading table data
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {error instanceof Error
                ? error.message
                : "Unknown error occurred"}
            </p>
          </div>
        ) : tableData ? (
          <>
            {/* Filter Controls */}
            <div className="border-b border-border p-2 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newShowFilters = !showFilters;
                  logger.debug(
                    `${
                      newShowFilters ? "Showing" : "Hiding"
                    } filters for table: ${schemaName}.${tableName}`,
                    {
                      database: databaseName,
                      schema: schemaName,
                      table: tableName,
                      showFilters: newShowFilters,
                      activeFilterCount,
                    },
                    "TABLE_DATA_FILTER"
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
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="gap-2 text-xs"
                >
                  <XCircle className="h-3 w-3" />
                  Clear All Filters
                </Button>
              )}
            </div>

            <Table
              key={`table-${debouncedFilterKey}-${tableRows.length}`}
              containerClassName="h-full max-h-[500px] max-w-[85vw] px-4"
              style={{ height: "100%", maxHeight: "100%" }}
            >
              <TableHeader>
                <TableRow>
                  {filterHiddenColumns(tableData.columns).map((column) => {
                    // Check if this column has a relationship
                    const hasRelationship =
                      includeReferences &&
                      relationships.some((rel) => rel.FK_COLUMN === column);

                    return (
                      <TableHead key={column} className="font-semibold p-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span>{column}</span>
                            {hasRelationship && (
                              <Badge
                                variant="secondary"
                                className="text-xs px-1 py-0"
                              >
                                <Link2 className="h-3 w-3 mr-1" />
                                Ref
                              </Badge>
                            )}
                          </div>
                          {showFilters &&
                            (() => {
                              const hasRelationshipForColumn =
                                includeReferences &&
                                relationships.some(
                                  (rel) =>
                                    normalizeColumnName(rel.FK_COLUMN) ===
                                    normalizeColumnName(column)
                                );
                              const filterValue = filters[column] || "";

                              if (
                                hasRelationshipForColumn &&
                                includeReferences
                              ) {
                                return (
                                  <ReferenceColumnFilter
                                    columnName={column}
                                    databaseName={databaseName}
                                    schemaName={schemaName}
                                    tableName={tableName}
                                    includeReferences={includeReferences}
                                    showFilters={showFilters}
                                    hasRelationship={hasRelationshipForColumn}
                                    filterValue={filterValue}
                                    onChange={(nextValue) =>
                                      handleFilterChange(column, nextValue)
                                    }
                                    onClear={() => handleClearFilter(column)}
                                  />
                                );
                              }

                              return (
                                <InputGroup className="h-7">
                                  <InputGroupInput
                                    type="text"
                                    placeholder="Filter..."
                                    value={filterValue}
                                    onChange={(e) =>
                                      handleFilterChange(column, e.target.value)
                                    }
                                    className="text-xs"
                                  />
                                  {filterValue && (
                                    <InputGroupAddon align="inline-end">
                                      <InputGroupButton
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => handleClearFilter(column)}
                                        type="button"
                                        className="text-destructive hover:text-destructive/80"
                                      >
                                        <XCircle className="h-3 w-3" />
                                      </InputGroupButton>
                                    </InputGroupAddon>
                                  )}
                                </InputGroup>
                              );
                            })()}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length > 0 ? (
                  tableRows.map((row, rowIndex) => {
                    const firstColumn = tableData.columns[0];
                    const primaryOriginalId =
                      firstColumn && row[`${firstColumn}_OriginalId`];
                    const fallbackOriginalId = row["Oid_OriginalId"];
                    const uniqueKey =
                      primaryOriginalId ??
                      fallbackOriginalId ??
                      row["Id"] ??
                      row["Oid"] ??
                      (firstColumn ? row[firstColumn] : undefined) ??
                      `${rowIndex}-${debouncedFilterKey}`;
                    return (
                      <TableRow key={String(uniqueKey)}>
                        {filterHiddenColumns(tableData.columns).map(
                          (column) => (
                            <TableCell key={column} className="max-w-xs">
                              <TableCellComponent value={row[column]} />
                            </TableCell>
                          )
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={filterHiddenColumns(tableData.columns).length}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {hasActiveFilters
                        ? "No rows match the current filters"
                        : "No data available for this table"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

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
                        ({tableData.columns.length} columns)
                      </span>
                    </>
                  ) : (
                    <>
                      Showing {pagination.offset + 1} -{" "}
                      {Math.min(pagination.offset + limit, totalRows)} of{" "}
                      {totalRows} rows ({tableData.columns.length} columns)
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
                  disabled={!tableData?.hasMore}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pagination.handleLastPage}
                  disabled={
                    !tableData?.hasMore ||
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
