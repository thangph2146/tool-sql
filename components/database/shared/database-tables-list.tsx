"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Table as TableIcon,
  Loader2,
  RefreshCw,
  Filter,
  XCircle,
  GitCompare,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
import { useTestTable, useTableStats } from "@/lib/hooks/use-database-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  TABLE_LIST_LIMIT_OPTIONS,
  DEFAULT_TABLE_LIST_LIMIT,
  DEFAULT_TABLE_PAGE,
} from "@/lib/constants/table-constants";
import { useDatabaseTables } from "@/lib/hooks/use-database-query";
import { useDebounce } from "@/lib/hooks/use-debounce";

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
  const [filterText, setFilterText] = useState("");
  // Pagination state
  const [page, setPage] = useState(DEFAULT_TABLE_PAGE);
  const [limit, setLimit] = useState(DEFAULT_TABLE_LIST_LIMIT);

  // Debounce filter text to avoid too many API calls while typing
  const debouncedFilterText = useDebounce(filterText, 500);

  // Use hook to fetch tables with server-side filtering and pagination
  // Use debounced filter text for API calls
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
  const totalCount = tablesData?.data?.totalCount || tables.length;
  // Track tables that have errors
  const [errorTables, setErrorTables] = useState<Set<string>>(new Set());
  // Track table status: 'idle' | 'testing' | 'success' | 'error'
  const [tableStatuses, setTableStatuses] = useState<
    Map<string, "idle" | "testing" | "success" | "error">
  >(new Map());
  // Track which tables are being tested
  const [testingTables, setTestingTables] = useState<Set<string>>(new Set());
  // Track table stats: row count, column count, relationship count
  const [tableStats, setTableStats] = useState<
    Map<
      string,
      { rowCount: number; columnCount: number; relationshipCount: number }
    >
  >(new Map());

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

  // Pagination calculations
  const totalPages = useMemo(
    () => Math.ceil(filteredCount / limit),
    [filteredCount, limit]
  );
  const currentPage = useMemo(() => page + 1, [page]);
  const offset = useMemo(() => page * limit, [page, limit]);

  // Reset page when debounced filter changes (not when filterText changes immediately)
  useEffect(() => {
    setPage(0);
  }, [debouncedFilterText]);

  // Reset page when limit changes
  useEffect(() => {
    setPage(0);
  }, [limit]);

  // Memoize display name
  const displayName = useMemo(() => {
    return (
      dbConfig.displayName ||
      dbConfig.database ||
      databaseName.replace("_", " ").toUpperCase()
    );
  }, [dbConfig, databaseName]);

  const handleTableClick = (schema: string, table: string) => {
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
      setErrorTables((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tableKey);
        return newSet;
      });
    }
    setSelectedTable({ schema, table });
  };

  const handleCloseTableData = () => {
    setSelectedTable(null);
  };

  const handleClearFilter = () => {
    setFilterText("");
  };

  // Handle table error from TableDataView
  const handleTableError = useCallback(
    (schema: string, table: string) => {
      const tableKey = `${schema}.${table}`;
      setErrorTables((prev) => new Set(prev).add(tableKey));
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
    [databaseName]
  );

  // Check if a table has an error
  const hasTableError = useCallback(
    (schema: string, table: string) => {
      const tableKey = `${schema}.${table}`;
      return errorTables.has(tableKey);
    },
    [errorTables]
  );

  // Test a single table
  const testTable = useCallback(
    (schema: string, table: string) => {
      const tableKey = `${schema}.${table}`;
      if (testingTables.has(tableKey)) return; // Already testing

      setTestingTables((prev) => new Set(prev).add(tableKey));
      setTableStatuses((prev) => {
        const newMap = new Map(prev);
        newMap.set(tableKey, "testing");
        return newMap;
      });
    },
    [testingTables]
  );

  // Component to test individual table using API route
  // Only test when explicitly triggered (click), not on hover
  function TableTester({ schema, table }: { schema: string; table: string }) {
    const tableKey = `${schema}.${table}`;
    const isTesting = testingTables.has(tableKey);
    const status = tableStatuses.get(tableKey) || "idle";

    // Only enable test when explicitly testing (click) or retrying after error
    const shouldTest = isTesting || status === "error";

    const { data, error, isLoading } = useTestTable(
      databaseName,
      schema,
      table,
      shouldTest // Only enable when explicitly testing
    );

    useEffect(() => {
      // Only process results when explicitly testing (click) or retrying after error
      if (!shouldTest) return;

      if (error) {
        setTableStatuses((prev) => {
          // Only update if status is not already 'error'
          if (prev.get(tableKey) === "error") return prev;
          const newMap = new Map(prev);
          newMap.set(tableKey, "error");
          return newMap;
        });
        setErrorTables((prev) => {
          if (prev.has(tableKey)) return prev; // Already added
          return new Set(prev).add(tableKey);
        });
        setTestingTables((prev) => {
          if (!prev.has(tableKey)) return prev; // Already removed
          const newSet = new Set(prev);
          newSet.delete(tableKey);
          return newSet;
        });
      } else if (data && !isLoading) {
        const isAccessible = data.success && data.data.accessible;
        const newStatus = isAccessible ? "success" : "error";

        setTableStatuses((prev) => {
          // Only update if status actually changed
          if (prev.get(tableKey) === newStatus) return prev;
          const newMap = new Map(prev);
          newMap.set(tableKey, newStatus);
          return newMap;
        });

        if (isAccessible) {
          // Clear error if table is now working
          setErrorTables((prev) => {
            if (!prev.has(tableKey)) return prev; // Already cleared
            const newSet = new Set(prev);
            newSet.delete(tableKey);
            return newSet;
          });
        } else {
          setErrorTables((prev) => {
            if (prev.has(tableKey)) return prev; // Already added
            return new Set(prev).add(tableKey);
          });
        }

        setTestingTables((prev) => {
          if (!prev.has(tableKey)) return prev; // Already removed
          const newSet = new Set(prev);
          newSet.delete(tableKey);
          return newSet;
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      data?.success,
      data?.data?.accessible,
      error,
      isLoading,
      shouldTest,
      tableKey,
    ]);

    return null; // This component doesn't render anything
  }

  // Component to fetch table stats (rows, columns, relationships)
  // Only fetch if stats are not already available from API response
  function TableStats({ schema, table }: { schema: string; table: string }) {
    const tableKey = `${schema}.${table}`;
    const status = tableStatuses.get(tableKey) || "idle";

    // Check if stats are already available from API response
    // Stats must be defined and not null (null means stats fetch failed)
    const tableFromList = tables?.find(
      (t) => t.TABLE_SCHEMA === schema && t.TABLE_NAME === table
    );
    const hasStatsFromApi =
      tableFromList &&
      tableFromList.rowCount !== undefined &&
      tableFromList.rowCount !== null &&
      tableFromList.columnCount !== undefined &&
      tableFromList.columnCount !== null &&
      tableFromList.relationshipCount !== undefined &&
      tableFromList.relationshipCount !== null;

    // Only fetch stats when table is successfully tested AND stats are not already available
    const shouldFetchStats = status === "success" && !hasStatsFromApi;

    const { data: statsData, error } = useTableStats(
      databaseName,
      schema,
      table,
      shouldFetchStats
    );

    useEffect(() => {
      if (shouldFetchStats) {
        if (statsData?.success && statsData.data) {
          const newStats = {
            rowCount: statsData.data.rowCount,
            columnCount: statsData.data.columnCount,
            relationshipCount: statsData.data.relationshipCount,
          };

          setTableStats((prev) => {
            // Only update if stats actually changed
            const existing = prev.get(tableKey);
            if (
              existing &&
              existing.rowCount === newStats.rowCount &&
              existing.columnCount === newStats.columnCount &&
              existing.relationshipCount === newStats.relationshipCount
            ) {
              return prev; // No change, return same reference
            }

            logger.info(
              "Table stats fetched successfully",
              {
                database: databaseName,
                schema,
                table,
                stats: newStats,
              },
              "TABLE_LIST"
            );

            const newMap = new Map(prev);
            newMap.set(tableKey, newStats);
            return newMap;
          });
        } else if (error) {
          // Log error but don't block UI
          logger.warn(
            "Failed to fetch table stats",
            {
              database: databaseName,
              schema,
              table,
              error,
            },
            "TABLE_LIST"
          );
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      shouldFetchStats,
      statsData?.success,
      statsData?.data?.rowCount,
      statsData?.data?.columnCount,
      statsData?.data?.relationshipCount,
      tableKey,
      error,
      hasStatsFromApi,
    ]);

    return null; // This component doesn't render anything
  }

  // Test all tables
  const testAllTables = useCallback(() => {
    if (!tables) return;
    tables.forEach((table) => {
      testTable(table.TABLE_SCHEMA, table.TABLE_NAME);
    });
  }, [tables, testTable]);

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
                onClick={testAllTables}
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
                  const isSelectedLeft =
                    selectedForComparison?.left?.databaseName ===
                      databaseName &&
                    selectedForComparison?.left?.schema ===
                      table.TABLE_SCHEMA &&
                    selectedForComparison?.left?.table === table.TABLE_NAME;
                  const isSelectedRight =
                    selectedForComparison?.right?.databaseName ===
                      databaseName &&
                    selectedForComparison?.right?.schema ===
                      table.TABLE_SCHEMA &&
                    selectedForComparison?.right?.table === table.TABLE_NAME;
                  const isSelected = isSelectedLeft || isSelectedRight;
                  const hasError = hasTableError(
                    table.TABLE_SCHEMA,
                    table.TABLE_NAME
                  );
                  const tableKey = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
                  const status = tableStatuses.get(tableKey) || "idle";
                  const isTesting = status === "testing";
                  const isSuccess = status === "success";
                  // Use stats from API response if available, otherwise use fetched stats
                  // Check if stats are available and not null (null means stats fetch failed)
                  const hasStatsFromApi =
                    table.rowCount !== undefined &&
                    table.rowCount !== null &&
                    table.columnCount !== undefined &&
                    table.columnCount !== null &&
                    table.relationshipCount !== undefined &&
                    table.relationshipCount !== null;
                  const statsFromApi = hasStatsFromApi
                    ? {
                        rowCount: table.rowCount!,
                        columnCount: table.columnCount!,
                        relationshipCount: table.relationshipCount!,
                      }
                    : null;
                  const stats = statsFromApi || tableStats.get(tableKey);
                  const hasStats =
                    stats &&
                    stats.rowCount !== null &&
                    stats.rowCount !== undefined &&
                    stats.columnCount !== null &&
                    stats.columnCount !== undefined &&
                    stats.relationshipCount !== null &&
                    stats.relationshipCount !== undefined;

                  return (
                    <TableRow
                      key={tableKey}
                      className={`cursor-pointer transition-colors ${
                        hasError
                          ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30"
                          : isSelectedLeft
                          ? "bg-blue-500/10 hover:bg-blue-500/20"
                          : isSelectedRight
                          ? "bg-green-500/10 hover:bg-green-500/20"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => {
                        handleTableClick(table.TABLE_SCHEMA, table.TABLE_NAME);
                      }}
                    >
                      <TableCell
                        className={cn(
                          "sticky left-0 z-20 bg-white border-r font-medium w-[200px] min-w-[200px] max-w-[200px] whitespace-normal break-words",
                          hasError
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 flex items-center gap-1 mt-0.5">
                            {isTesting && (
                              <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                            )}
                            {hasError && !isTesting && (
                              <AlertCircle className="h-3 w-3 text-red-500" />
                            )}
                            {isSuccess && !hasError && !isTesting && (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span
                              className={
                                hasError ? "text-red-700 dark:text-red-300" : ""
                              }
                            >
                              {table.TABLE_NAME}
                            </span>
                            {isSelected && (
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold px-1.5 py-0.5 mt-1 block ${
                                  isSelectedLeft
                                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                    : "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                                }`}
                              >
                                {isSelectedLeft ? "1st" : "2nd"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[120px] min-w-[120px] max-w-[120px]",
                          hasError
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {table.TABLE_SCHEMA}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[80px] min-w-[80px] max-w-[80px]",
                          isTesting
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            : hasError
                            ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
                            : isSuccess
                            ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                            : ""
                        )}
                      >
                        {isTesting ? (
                          <Badge variant="outline" className="text-xs">
                            Testing
                          </Badge>
                        ) : hasError ? (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        ) : isSuccess ? (
                          <Badge
                            variant="default"
                            className="text-xs bg-green-500"
                          >
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Idle
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[100px] min-w-[100px] max-w-[100px]",
                          "text-right text-muted-foreground"
                        )}
                      >
                        {hasStats ? stats!.rowCount.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[80px] min-w-[80px] max-w-[80px]",
                          "text-right text-muted-foreground"
                        )}
                      >
                        {hasStats ? stats!.columnCount : "-"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[100px] min-w-[100px] max-w-[100px]",
                          "text-right text-muted-foreground"
                        )}
                      >
                        {hasStats ? stats!.relationshipCount : "-"}
                      </TableCell>
                      <TableCell
                        className={`w-[80px] min-w-[80px] max-w-[80px] sticky text-center justify-center items-center right-0 z-10 bg-white border-l ${
                          hasError
                            ? "bg-red-50 dark:bg-red-950/20"
                            : isSelectedLeft
                            ? "bg-blue-500/10"
                            : isSelectedRight
                            ? "bg-green-500/10"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-1 justify-center items-center">
                          {onCompareTable && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                logger.info(
                                  "Table selected for comparison",
                                  {
                                    database: databaseName,
                                    schema: table.TABLE_SCHEMA,
                                    table: table.TABLE_NAME,
                                  },
                                  "TABLE_LIST"
                                );
                                onCompareTable({
                                  databaseName,
                                  schema: table.TABLE_SCHEMA,
                                  table: table.TABLE_NAME,
                                });
                              }}
                              className="h-6 w-6"
                              title="Compare this table with another"
                            >
                              <GitCompare className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {/* Hidden components to test table and fetch stats */}
                        <TableTester
                          schema={table.TABLE_SCHEMA}
                          table={table.TABLE_NAME}
                        />
                        <TableStats
                          schema={table.TABLE_SCHEMA}
                          table={table.TABLE_NAME}
                        />
                      </TableCell>
                    </TableRow>
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
