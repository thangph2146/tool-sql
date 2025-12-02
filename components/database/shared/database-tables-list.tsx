"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Table as TableIcon,
  Loader2,
  RefreshCw,
  Filter,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { DatabaseName } from "@/lib/db-config";
import { getDatabaseConfig } from "@/lib/db-config";
import { getMergedDatabaseConfig } from "@/lib/utils/db-config-storage";
import { logger } from "@/lib/logger";
import { TableDataView } from "../tables/table-data-view";
import { useTableTesting, useTableStatsManager, useTableListState } from "@/lib/hooks";
import { TableRowItemWrapper } from "./table-row-item-wrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TABLE_LIST_LIMIT_OPTIONS } from "@/lib/constants/table-constants";
import { useDatabaseTables } from "@/lib/hooks/use-database-query";

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
  rowCount?: number | null;
  columnCount?: number | null;
  relationshipCount?: number | null;
}

interface DatabaseTablesListProps {
  databaseName: DatabaseName;
  tables?: TableInfo[]; // Deprecated: will use hook instead
  isLoading?: boolean; // Deprecated: will use hook instead
  onRefresh: () => void;
  onCompareTable?: (table: {
    databaseName: DatabaseName;
    schema: string;
    table: string;
  }) => void;
  selectedForComparison?: {
    left: { databaseName: DatabaseName; schema: string; table: string } | null;
    right: { databaseName: DatabaseName; schema: string; table: string } | null;
  };
}

export function DatabaseTablesList({
  databaseName,
  tables: propsTables, // Deprecated: use hook instead
  isLoading: propsIsLoading, // Deprecated: use hook instead
  onRefresh,
  onCompareTable,
  selectedForComparison,
}: DatabaseTablesListProps) {
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    table: string;
  } | null>(null);

  // Use custom hook for table list state (filter, pagination)
  const {
    filterText,
    debouncedFilterText,
    page,
    limit,
    setFilterText,
    setPage,
    setLimit,
    handleClearFilter,
    currentPage,
    offset,
  } = useTableListState();

  // Use hook to fetch tables with server-side filtering and pagination
  // Use debounced filter text for API calls
  // Use select to only subscribe to data we need
  const { data: tablesData, isLoading: tablesLoading } = useDatabaseTables(
    databaseName,
    true, // enabled
    true, // includeStats
    {
      filterText: debouncedFilterText,
      limit,
      page,
    }
  );

  // Use data from hook if available, otherwise fall back to props (for backward compatibility)
  const tables = useMemo((): TableInfo[] => {
    return (tablesData?.data?.tables || propsTables || []) as TableInfo[];
  }, [tablesData?.data?.tables, propsTables]);

  const isLoading = tablesLoading || propsIsLoading || false;
  const totalCount = useMemo(
    () => tablesData?.data?.totalCount || tables.length,
    [tablesData?.data?.totalCount, tables.length]
  );

  // Recalculate totalPages with actual totalCount
  const totalPages = useMemo(
    () => Math.ceil(totalCount / limit) || 1,
    [totalCount, limit]
  );

  // Use custom hooks for table testing and stats management
  const {
    tableStatuses,
    errorTables,
    testingTables,
    testTable,
    testAllTables,
    hasTableError,
    setTableStatus,
    setErrorTable,
    setTestingTable,
  } = useTableTesting(databaseName);

  const { getStats, setStats } = useTableStatsManager(databaseName);

  // Get database config to display actual database name
  // Start with base config to avoid hydration mismatch, then update with merged config on client
  const [dbConfig, setDbConfig] = useState(() => getDatabaseConfig(databaseName));
  
  // Update to merged config after mount to avoid hydration mismatch
  useEffect(() => {
    setDbConfig(getMergedDatabaseConfig(databaseName));
  }, [databaseName]);

  // Server-side filtering and pagination - tables are already filtered and paginated from API
  const paginatedTables = tables; // Tables from API are already filtered and paginated

  // Memoize table count
  const tableCount = useMemo(
    () => totalCount || tables.length,
    [totalCount, tables.length]
  );
  const filteredCount = totalCount; // Total count after filtering (from API)

  // Memoize display name
  const displayName = useMemo(() => {
    return (
      dbConfig.displayName ||
      dbConfig.database ||
      databaseName.replace("_", " ").toUpperCase()
    );
  }, [dbConfig, databaseName]);

  const handleTableClick = useCallback(
    (schema: string, table: string) => {
      logger.info(
        "Table selected for viewing",
        {
          database: databaseName,
          schema,
          table,
        },
        "TABLE_LIST"
      );

      const tableKey = `${schema}.${table}`;
      const status = tableStatuses.get(tableKey) || "idle";

      // Test table on click if not tested yet or has error
      if (status === "idle" || status === "error") {
        testTable(schema, table);
      }

      // Clear error state when user retries to view the table
      if (errorTables.has(tableKey)) {
        setErrorTable(schema, table, false);
      }
      setSelectedTable({ schema, table });
    },
    [databaseName, tableStatuses, testTable, errorTables, setErrorTable]
  );

  const handleCloseTableData = useCallback(() => {
    setSelectedTable(null);
  }, []);

  // Handle table error from TableDataView
  const handleTableError = useCallback(
    (schema: string, table: string) => {
      setErrorTable(schema, table, true);
      logger.warn(
        "Table error detected",
        {
          database: databaseName,
          schema,
          table,
        },
        "TABLE_LIST"
      );
    },
    [databaseName, setErrorTable]
  );



  // Test all tables handler
  const handleTestAllTables = useCallback(() => {
    if (!tables) return;
    testAllTables(tables);
  }, [tables, testAllTables]);

  return (
    <div className="mt-4 pt-4">
      <Separator className="mb-4" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Tables in {displayName}
          </h3>
          {tables && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {tableCount} {tableCount === 1 ? "table" : "tables"}
            </span>
          )}
        </div>
        <div className="flex items-center bg-white p-2 rounded-md gap-2">
          {tables && !isLoading && (
            <>
              <Button
                onClick={handleTestAllTables}
                variant="ghost"
                size="sm"
                title="Test all tables"
                disabled={testingTables.size > 0}
              >
                <Loader2
                  className={`h-4 w-4 ${
                    testingTables.size > 0 ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">Test All</span>
              </Button>
              <Button
                onClick={onRefresh}
                variant="ghost"
                size="sm"
                title="Refresh tables list"
              >
                <RefreshCw />
                Refresh
              </Button>
            </>
          )}
          {!tables && !isLoading && (
            <Button onClick={onRefresh} variant="ghost" size="sm">
              Load Tables
            </Button>
          )}
        </div>
      </div>
      {/* Filter Input */}
      <div className="relative bg-white rounded-md mb-4 border">
        <div className="relative">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter tables by name or schema..."
            value={filterText}
            onChange={(e) => {
              const newValue = e.target.value;
              setFilterText(newValue);
            }}
            className="pl-8 pr-8 h-8 text-xs"
          />
          {filterText && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClearFilter}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              title="Clear filter"
            >
              <XCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">
            Loading tables from {displayName}...
          </span>
        </div>
      ) : tables && tables.length > 0 ? (
        <div className="space-y-2 bg-white p-2 rounded-md">
          <Table containerClassName="max-h-[calc(100vh-300px)] min-h-[400px] bg-white overflow-y-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] min-w-[200px] max-w-[200px] sticky left-0 z-20 bg-background border-r whitespace-normal break-words">
                  Table Name
                </TableHead>
                <TableHead className="w-[120px] min-w-[120px] max-w-[120px]">
                  Schema
                </TableHead>
                <TableHead className="w-[80px] min-w-[80px] max-w-[80px]">
                  Status
                </TableHead>
                <TableHead className="w-[100px] min-w-[100px] max-w-[100px] text-right">
                  Rows
                </TableHead>
                <TableHead className="w-[80px] min-w-[80px] max-w-[80px] text-right">
                  Columns
                </TableHead>
                <TableHead className="w-[100px] min-w-[100px] max-w-[100px] text-right">
                  Relationships
                </TableHead>
                <TableHead className="w-[80px] min-w-[80px] max-w-[80px] sticky text-center right-0 z-20 bg-white border-l">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTables.length > 0 ? (
                paginatedTables.map((table) => {
                  const tableKey = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
                  const status = tableStatuses.get(tableKey) || "idle";
                  const isTesting = status === "testing";
                  const hasError =
                    status === "error" ||
                    (status !== "success" &&
                      hasTableError(table.TABLE_SCHEMA, table.TABLE_NAME));
                  const stats = getStats(
                    table.TABLE_SCHEMA,
                    table.TABLE_NAME,
                    tables
                  );
                  const hasStats = stats !== null;

                  return (
                    <TableRowItemWrapper
                      key={tableKey}
                      table={table}
                      databaseName={databaseName}
                      selectedForComparison={selectedForComparison}
                      tableKey={tableKey}
                      status={status}
                      isTesting={isTesting}
                      hasError={hasError}
                      stats={stats}
                      hasStats={hasStats}
                      onTableClick={handleTableClick}
                      onCompareTable={onCompareTable}
                      onStatusChange={setTableStatus}
                      onErrorChange={setErrorTable}
                      onTestingChange={setTestingTable}
                      onStatsUpdate={(schema, table, partialStats) => {
                        const currentStats = getStats(schema, table, tables);
                        if (!currentStats || currentStats.columnCount === 0) {
                          setStats(schema, table, {
                            rowCount: currentStats?.rowCount ?? 0,
                            columnCount: partialStats.columnCount,
                            relationshipCount:
                              currentStats?.relationshipCount ?? 0,
                          });
                        }
                      }}
                      onStatsFetched={setStats}
                      tables={tables}
                    />
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    <TableIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-muted-foreground">
                      No tables match &quot;{filterText}&quot;
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Separator />
          {/* Pagination Controls */}
          {filteredCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Rows per page:
                </span>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    const newLimit = parseInt(value, 10);
                    setLimit(newLimit);
                  }}
                >
                  <SelectTrigger size="sm" className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_LIST_LIMIT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option.toString()}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {offset + 1}-{Math.min(offset + limit, filteredCount)} of{" "}
                  {filteredCount}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="h-7 w-7 p-0"
                    title="First page"
                  >
                    <ChevronsLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="h-7 w-7 p-0"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-xs text-muted-foreground">Page</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages || 1}
                      value={currentPage}
                      onChange={(e) => {
                        const pageNum = parseInt(e.target.value, 10);
                        if (
                          !isNaN(pageNum) &&
                          pageNum >= 1 &&
                          pageNum <= totalPages
                        ) {
                          setPage(pageNum - 1);
                        }
                      }}
                      className="h-7 w-12 text-center text-xs"
                    />
                    <span className="text-xs text-muted-foreground">
                      of {totalPages || 1}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="h-7 w-7 p-0"
                    title="Next page"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="h-7 w-7 p-0"
                    title="Last page"
                  >
                    <ChevronsRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground text-center pt-2">
            {filterText ? (
              <>
                Showing {filteredCount} of {tableCount}{" "}
                {tableCount === 1 ? "table" : "tables"}
                {filteredCount !== tableCount && (
                  <span className="text-primary"> (filtered)</span>
                )}
              </>
            ) : (
              <>
                Showing {tableCount} {tableCount === 1 ? "table" : "tables"}{" "}
                from {displayName} database
              </>
            )}
          </p>
        </div>
      ) : tables && tables.length === 0 ? (
        <div className="text-center py-4">
          <TableIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-xs text-muted-foreground">
            No tables found in {displayName} database
          </p>
        </div>
      ) : null}

      {/* Table Data View Dialog */}
      <Dialog
        open={!!selectedTable}
        onOpenChange={(open) => !open && handleCloseTableData()}
      >
        <DialogContent className="w-full  p-0" showCloseButton={true}>
          {selectedTable && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  Table Data: {selectedTable.schema}.{selectedTable.table}
                </DialogTitle>
                <DialogDescription>
                  Viewing data from {selectedTable.schema}.{selectedTable.table}{" "}
                  in {databaseName} database
                </DialogDescription>
              </DialogHeader>
              <TableDataView
                databaseName={databaseName}
                schemaName={selectedTable.schema}
                tableName={selectedTable.table}
                onTableChange={handleTableClick}
                onError={handleTableError}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
