"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Loader2,
  Database,
  GitCompare,
  Settings2,
  Filter,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DatabaseName } from "@/lib/db-config";
import { useTableData } from "@/lib/hooks/use-database-query";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import { useTableComparison } from "@/lib/hooks/use-table-comparison";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupButton, InputGroupAddon } from "@/components/ui/input-group";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";
import { TableCell as TableCellComponent } from "@/components/database/table-cell";
import { TABLE_COMPARISON_LIMIT_OPTIONS, DEFAULT_TABLE_LIMIT } from "@/lib/constants/table-constants";
import { categorizeColumns, getColumnsToDisplay } from "@/lib/utils/table-column-utils";

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
}

export function TableComparisonView({
  leftTable,
  rightTable,
  onClose,
  open = true,
  asDialog = false,
}: TableComparisonViewProps) {
  const [limit, setLimit] = useState(DEFAULT_TABLE_LIMIT);
  const [page, setPage] = useState(0);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const offset = page * limit;

  // Fetch data for both tables
  const leftData = useTableData(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    limit,
    offset,
    true
  );

  const rightData = useTableData(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    limit,
    offset,
    true
  );

  const leftTableData = leftData.data?.data;
  const rightTableData = rightData.data?.data;

  // Get all unique columns from both tables
  const allColumns = useMemo(() => {
    const leftCols = (leftTableData?.columns || []).map(c => String(c).trim());
    const rightCols = (rightTableData?.columns || []).map(c => String(c).trim());
    const uniqueCols = new Set([...leftCols, ...rightCols]);
    return Array.from(uniqueCols).sort();
  }, [leftTableData?.columns, rightTableData?.columns]);

  // Categorize columns by table using utility function
  const columnCategories = useMemo(() => {
    if (!leftTableData?.columns || !rightTableData?.columns) {
      return { leftOnly: [], rightOnly: [], both: [] };
    }
    return categorizeColumns(leftTableData.columns, rightTableData.columns);
  }, [leftTableData?.columns, rightTableData?.columns]);

  // Initialize selected columns (select all by default when columns change)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => {
    // Lazy initialization - will be set in useEffect
    return new Set();
  });

  // Update selected columns when allColumns changes (select all by default)
  useEffect(() => {
    if (allColumns.length > 0) {
      setSelectedColumns((prev) => {
        // Only update if empty
        if (prev.size === 0) {
          return new Set(allColumns);
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allColumns.length]); // Only depend on length to avoid infinite loop

  // Get columns to compare (only selected ones)
  const columnsToCompare = useMemo(() => {
    return allColumns.filter(col => selectedColumns.has(col));
  }, [allColumns, selectedColumns]);

  // Get columns to display using utility function
  const leftColumnsToDisplay = useMemo(() => {
    if (!leftTableData?.columns) return [];
    return getColumnsToDisplay(leftTableData.columns, selectedColumns);
  }, [selectedColumns, leftTableData?.columns]);

  const rightColumnsToDisplay = useMemo(() => {
    if (!rightTableData?.columns) return [];
    return getColumnsToDisplay(rightTableData.columns, selectedColumns);
  }, [selectedColumns, rightTableData?.columns]);

  // Use filters hook for left table
  const leftTableFilters = useTableFilters({
    rows: leftTableData?.rows || [],
  });

  // Use filters hook for right table
  const rightTableFilters = useTableFilters({
    rows: rightTableData?.rows || [],
  });

  // Compare rows using optimized hook
  const comparisonResult = useTableComparison({
    leftRows: leftTableFilters.filteredRows,
    rightRows: rightTableFilters.filteredRows,
    columnsToCompare,
  });

  // Memoize computed values for performance
  const isLoading = useMemo(() => leftData.isLoading || rightData.isLoading, [leftData.isLoading, rightData.isLoading]);
  const hasError = useMemo(() => leftData.error || rightData.error, [leftData.error, rightData.error]);
  
  // Memoize active filter counts
  const leftActiveFilterCount = useMemo(
    () => Object.values(leftTableFilters.filters).filter((v) => v.trim() !== "").length,
    [leftTableFilters.filters]
  );
  const rightActiveFilterCount = useMemo(
    () => Object.values(rightTableFilters.filters).filter((v) => v.trim() !== "").length,
    [rightTableFilters.filters]
  );
  
  // Memoize difference count
  const differenceCount = useMemo(
    () => comparisonResult ? Array.from(comparisonResult.values()).filter((d) => d.status !== "same").length : 0,
    [comparisonResult]
  );

  const content = (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading table data...
            </span>
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Database className="h-12 w-12 text-destructive mb-4 opacity-50" />
            <p className="text-sm font-medium text-foreground mb-2">
              Error loading table data
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {leftData.error instanceof Error
                ? leftData.error.message
                : rightData.error instanceof Error
                  ? rightData.error.message
                  : "Unknown error occurred"}
            </p>
          </div>
        ) : leftTableData && rightTableData ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Comparison Stats */}
            <div className="border-b border-border p-2 bg-muted/50">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-muted-foreground">
                    Left: {leftTable.databaseName} ({leftTableData.totalRows}{" "}
                    rows, {leftTableData.columns.length} columns)
                  </span>
                  <span className="text-muted-foreground">
                    Right: {rightTable.databaseName} ({rightTableData.totalRows}{" "}
                    rows, {rightTableData.columns.length} columns)
                  </span>
                  {comparisonResult && (
                    <span className="text-primary font-medium">
                      Differences: {differenceCount}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Comparing: {columnsToCompare.length} of {allColumns.length} columns
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="gap-2 text-xs"
                  >
                    <Settings2 className="h-3 w-3" />
                    Select Columns
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Limit:
                  </span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TABLE_COMPARISON_LIMIT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Column Selector */}
              {showColumnSelector && (
                <div className="mt-3 p-3 border border-border rounded-md bg-background">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Select columns to compare:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedColumns(new Set(allColumns))}
                        className="text-xs h-6"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedColumns(new Set())}
                        className="text-xs h-6"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex pace-y-4">
                    {/* Common Columns (Both Tables) */}
                    {columnCategories.both.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-4 rounded bg-primary/20 border border-primary/50"></div>
                          <span className="text-xs font-semibold text-foreground">
                            Common Columns ({columnCategories.both.length})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            - Present in both tables
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ml-6">
                          {columnCategories.both.map((column) => {
                            const isSelected = selectedColumns.has(column);
                            return (
                              <label
                                key={column}
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-xs border border-primary/20"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedColumns);
                                    if (e.target.checked) {
                                      newSelected.add(column);
                                    } else {
                                      newSelected.delete(column);
                                    }
                                    setSelectedColumns(newSelected);
                                  }}
                                  className="h-4 w-4 rounded border-input cursor-pointer"
                                />
                                <span className="flex-1 truncate" title={column}>
                                  {column}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Left Table Only Columns */}
                    {columnCategories.leftOnly.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-4 rounded bg-blue-500/20 border border-blue-500/50"></div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            Left Table Only ({columnCategories.leftOnly.length})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            - {leftTable.databaseName}
                          </span>
                        </div>
                        <ScrollArea className="max-h-[200px] overflow-y-auto">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ml-6">
                          {columnCategories.leftOnly.map((column) => {
                            const isSelected = selectedColumns.has(column);
                            return (
                              <label
                                key={column}
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-xs border border-blue-500/20 bg-blue-500/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedColumns);
                                    if (e.target.checked) {
                                      newSelected.add(column);
                                    } else {
                                      newSelected.delete(column);
                                    }
                                    setSelectedColumns(newSelected);
                                  }}
                                  className="h-4 w-4 rounded border-input cursor-pointer"
                                />
                                <span className="flex-1 truncate" title={column}>
                                  {column}
                                </span>
                                <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400 border-blue-500/50" title="Only in left table">
                                  L
                                </Badge>
                              </label>
                            );
                          })}
                        </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Right Table Only Columns */}
                    {columnCategories.rightOnly.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-4 rounded bg-green-500/20 border border-green-500/50"></div>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            Right Table Only ({columnCategories.rightOnly.length})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            - {rightTable.databaseName}
                          </span>
                        </div>
                        <ScrollArea className="max-h-[200px] overflow-y-auto">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ml-6">
                          {columnCategories.rightOnly.map((column) => {
                            const isSelected = selectedColumns.has(column);
                            return (
                              <label
                                key={column}
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-xs border border-green-500/20 bg-green-500/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedColumns);
                                    if (e.target.checked) {
                                      newSelected.add(column);
                                    } else {
                                      newSelected.delete(column);
                                    }
                                    setSelectedColumns(newSelected);
                                  }}
                                  className="h-4 w-4 rounded border-input cursor-pointer"
                                />
                                <span className="flex-1 truncate" title={column}>
                                  {column}
                                </span>
                                <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-500/50" title="Only in right table">
                                  R
                                </Badge>
                              </label>
                            );
                          })}
                        </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Side by Side Tables */}
            <div className="flex-1 grid grid-cols-2 gap-0 min-h-0 overflow-hidden">
              {/* Left Table */}
              <div className="flex flex-col border-r border-border min-h-0">
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Database className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">
                        {leftTable.databaseName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {leftTable.schemaName}.{leftTable.tableName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({leftColumnsToDisplay.length} columns)
                      </span>
                      {leftTableFilters.hasActiveFilters && (
                        <span className="text-xs text-muted-foreground">
                          • Showing {leftTableFilters.filteredRowCount} of {leftTableData.rows.length} rows
                          {leftTableFilters.filteredRowCount !== leftTableData.rows.length && (
                            <span className="text-primary"> (filtered)</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        <Filter className="h-3 w-3" />
                        {leftTableFilters.hasActiveFilters && (
                          <Badge className="text-xs">
                            {leftActiveFilterCount}
                          </Badge>
                        )}
                      </Button>
                      {leftTableFilters.hasActiveFilters && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={leftTableFilters.handleClearFilters}
                        >
                          <XCircle className="h-3 w-3" />
                          Clear All
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                    <Table containerClassName={cn("h-full max-w-[48vw] mx-auto px-4",showColumnSelector ? "max-h-[calc(100vh-600px)]" : "max-h-[500px]")}>
                      <TableHeader>
                        <TableRow>
                          {leftColumnsToDisplay.map((column) => (
                            <TableHead key={column} className="font-semibold p-2 text-xs">
                              <div className="flex flex-col gap-1">
                                <span>{column}</span>
                                {showFilters && (
                                  <InputGroup className="h-7">
                                    <InputGroupInput
                                      type="text"
                                      placeholder="Filter..."
                                      value={leftTableFilters.filters[column] || ""}
                                      onChange={(e) =>
                                        leftTableFilters.handleFilterChange(column, e.target.value)
                                      }
                                      className="text-xs"
                                    />
                                    {leftTableFilters.filters[column] && (
                                      <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                          variant="ghost"
                                          size="icon-xs"
                                          onClick={() => leftTableFilters.handleClearFilter(column)}
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
                        {leftTableFilters.filteredRows.length > 0 ? (
                          leftTableFilters.filteredRows.map((row, rowIndex) => {
                            const diff = comparisonResult?.get(rowIndex);
                            const isDifferent =
                              diff?.status === "different" ||
                              diff?.status === "left-only";

                            return (
                              <TableRow
                                key={rowIndex}
                                className={
                                  isDifferent
                                    ? "bg-destructive/10 hover:bg-destructive/20"
                                    : ""
                                }
                              >
                                {leftColumnsToDisplay.map((column) => {
                                  const isDiffColumn =
                                    diff?.diffColumns?.includes(column);
                                  return (
                                    <TableCell
                                      key={column}
                                      className={`max-w-xs p-2 text-xs ${
                                        isDiffColumn
                                          ? "bg-destructive/20 font-semibold"
                                          : ""
                                      }`}
                                    >
                                      <TableCellComponent value={row[column]} />
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={leftColumnsToDisplay.length}
                              className="text-center py-8 text-muted-foreground text-xs"
                            >
                              {leftTableFilters.hasActiveFilters
                                ? "No rows match the current filters"
                                : "No data"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                </div>
              </div>

              {/* Right Table */}
              <div className="flex flex-col min-h-0">
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Database className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">
                        {rightTable.databaseName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {rightTable.schemaName}.{rightTable.tableName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({rightColumnsToDisplay.length} columns)
                      </span>
                      {rightTableFilters.hasActiveFilters && (
                        <span className="text-xs text-muted-foreground">
                          • Showing {rightTableFilters.filteredRowCount} of {rightTableData.rows.length} rows
                          {rightTableFilters.filteredRowCount !== rightTableData.rows.length && (
                            <span className="text-primary"> (filtered)</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        <Filter className="h-3 w-3" />
                        {rightTableFilters.hasActiveFilters && (
                          <Badge className="text-xs">
                            {rightActiveFilterCount}
                          </Badge>
                        )}
                      </Button>
                      {rightTableFilters.hasActiveFilters && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={rightTableFilters.handleClearFilters}
                        >
                          <XCircle className="h-3 w-3" />
                          Clear All
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                    <Table containerClassName={cn("h-full max-w-[48vw] mx-auto px-4",showColumnSelector ? "max-h-[calc(100vh-600px)]" : "max-h-[500px]")}>
                      <TableHeader>
                        <TableRow>
                          {rightColumnsToDisplay.map((column) => (
                            <TableHead key={column} className="font-semibold p-2 text-xs">
                              <div className="flex flex-col gap-1">
                                <span>{column}</span>
                                {showFilters && (
                                  <InputGroup className="h-7">
                                    <InputGroupInput
                                      type="text"
                                      placeholder="Filter..."
                                      value={rightTableFilters.filters[column] || ""}
                                      onChange={(e) =>
                                        rightTableFilters.handleFilterChange(column, e.target.value)
                                      }
                                      className="text-xs"
                                    />
                                    {rightTableFilters.filters[column] && (
                                      <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                          variant="ghost"
                                          size="icon-xs"
                                          onClick={() => rightTableFilters.handleClearFilter(column)}
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
                        {rightTableFilters.filteredRows.length > 0 ? (
                          rightTableFilters.filteredRows.map((row, rowIndex) => {
                            const diff = comparisonResult?.get(rowIndex);
                            const isDifferent =
                              diff?.status === "different" ||
                              diff?.status === "right-only";

                            return (
                              <TableRow
                                key={rowIndex}
                                className={
                                  isDifferent
                                    ? "bg-destructive/10 hover:bg-destructive/20"
                                    : ""
                                }
                              >
                                {rightColumnsToDisplay.map((column) => {
                                  const isDiffColumn =
                                    diff?.diffColumns?.includes(column);
                                  return (
                                    <TableCell
                                      key={column}
                                      className={`max-w-xs p-2 text-xs ${
                                        isDiffColumn
                                          ? "bg-destructive/20 font-semibold"
                                          : ""
                                      }`}
                                    >
                                      <TableCellComponent value={row[column]} />
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={rightColumnsToDisplay.length}
                              className="text-center py-8 text-muted-foreground text-xs"
                            >
                              {rightTableFilters.hasActiveFilters
                                ? "No rows match the current filters"
                                : "No data"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (asDialog) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
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

