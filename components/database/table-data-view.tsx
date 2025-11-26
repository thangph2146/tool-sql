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
} from "lucide-react";
import type { DatabaseName } from "@/lib/db-config";
import { useTableData } from "@/lib/hooks/use-database-query";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import { TABLE_LIMIT_OPTIONS, DEFAULT_TABLE_LIMIT } from "@/lib/constants/table-constants";
import { TableCell as TableCellComponent } from "@/components/database/table-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput, InputGroupButton, InputGroupAddon } from "@/components/ui/input-group";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

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

  // Fetch initial data to get totalRows (minimal fetch)
  const { data: initialData } = useTableData(
    databaseName,
    schemaName,
    tableName,
    1,
    0,
    true
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

  // Fetch data with pagination
  const { data, isLoading, error } = useTableData(
    databaseName,
    schemaName,
    tableName,
    limit,
    pagination.offset,
    true
  );

  const tableData = data?.data;

  // Use filters hook
  const {
    filters,
    showFilters,
    setShowFilters,
    filteredRows,
    filteredRowCount,
    hasActiveFilters,
    handleFilterChange: baseHandleFilterChange,
    handleClearFilters: baseHandleClearFilters,
    handleClearFilter: baseHandleClearFilter,
  } = useTableFilters({
    rows: tableData?.rows || [],
  });

  // Enhanced filter handlers that reset pagination - memoized with useCallback
  const handleFilterChange = useCallback((column: string, value: string) => {
    baseHandleFilterChange(column, value);
    pagination.setPage(0);
  }, [baseHandleFilterChange, pagination]);

  const handleClearFilters = useCallback(() => {
    baseHandleClearFilters();
    pagination.setPage(0);
  }, [baseHandleClearFilters, pagination]);

  const handleClearFilter = useCallback((column: string) => {
    baseHandleClearFilter(column);
    pagination.setPage(0);
  }, [baseHandleClearFilter, pagination]);

  // Memoize active filter count
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v.trim() !== "").length,
    [filters]
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
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
          </p>
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
        ) : tableData && tableData.rows.length > 0 ? (
          <>
            {/* Filter Controls */}
            <div className="border-b border-border p-2 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
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
              containerClassName="h-full max-h-[500px] max-w-[85vw] px-4"
              style={{ height: "100%", maxHeight: "100%" }}
            >
              <TableHeader>
                <TableRow>
                  {tableData.columns.map((column) => (
                    <TableHead key={column} className="font-semibold p-2">
                      <div className="flex flex-col gap-1">
                        <span>{column}</span>
                        {showFilters && (
                          <InputGroup className="h-7">
                            <InputGroupInput
                              type="text"
                              placeholder="Filter..."
                              value={filters[column] || ""}
                              onChange={(e) => handleFilterChange(column, e.target.value)}
                              className="text-xs"
                            />
                            {filters[column] && (
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
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {tableData.columns.map((column) => (
                        <TableCell key={column} className="max-w-xs">
                          <TableCellComponent value={row[column]} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={tableData.columns.length}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No rows match the current filters
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
                      Showing {filteredRowCount} of {tableData.totalRows} rows
                      {filteredRowCount !== tableData.totalRows && (
                        <span className="text-primary"> (filtered)</span>
                      )}
                      <span className="ml-1">({tableData.columns.length} columns)</span>
                    </>
                  ) : (
                    <>
                      Showing {pagination.offset + 1} -{" "}
                      {Math.min(pagination.offset + limit, tableData.totalRows)} of{" "}
                      {tableData.totalRows} rows ({tableData.columns.length} columns)
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
                    onChange={(e) => pagination.handlePageInputChange(e.target.value)}
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
                  disabled={!tableData?.hasMore || pagination.currentPage >= pagination.totalPages}
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : tableData && tableData.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-sm font-medium text-foreground mb-2">
              No data found
            </p>
            <p className="text-xs text-muted-foreground">This table is empty</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
