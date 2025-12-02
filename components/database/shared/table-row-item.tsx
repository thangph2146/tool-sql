"use client";

import { memo } from "react";
import {
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatabaseName } from "@/lib/db-config";
import { TableTester } from "./table-tester";
import { TableStatsFetcher } from "./table-stats-fetcher";
import { logger } from "@/lib/logger";

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
  rowCount?: number | null;
  columnCount?: number | null;
  relationshipCount?: number | null;
}

interface TableRowItemProps {
  table: TableInfo;
  databaseName: DatabaseName;
  isSelectedLeft: boolean;
  isSelectedRight: boolean;
  status: "idle" | "testing" | "success" | "error";
  isTesting: boolean;
  hasError: boolean;
  stats: {
    rowCount: number;
    columnCount: number;
    relationshipCount: number;
  } | null;
  hasStats: boolean;
  onTableClick: (schema: string, table: string) => void;
  onCompareTable?: (table: {
    databaseName: DatabaseName;
    schema: string;
    table: string;
  }) => void;
  onStatusChange: (schema: string, table: string, status: "idle" | "testing" | "success" | "error") => void;
  onErrorChange: (schema: string, table: string, hasError: boolean) => void;
  onTestingChange: (schema: string, table: string, isTesting: boolean) => void;
  onStatsUpdate: (schema: string, table: string, partialStats: { columnCount: number }) => void;
  onStatsFetched: (schema: string, table: string, stats: {
    rowCount: number;
    columnCount: number;
    relationshipCount: number;
  }) => void;
  tables: TableInfo[];
}

function TableRowItemComponent({
  table,
  databaseName,
  isSelectedLeft,
  isSelectedRight,
  status,
  isTesting,
  hasError,
  stats,
  hasStats,
  onTableClick,
  onCompareTable,
  onStatusChange,
  onErrorChange,
  onTestingChange,
  onStatsUpdate,
  onStatsFetched,
  tables,
}: TableRowItemProps) {
  const isSelected = isSelectedLeft || isSelectedRight;
  const tableKey = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
  const isSuccess = status === "success";

  return (
    <TableRow
      className={cn(
        "cursor-pointer transition-colors",
        hasError
          ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30"
          : isSelectedLeft
          ? "bg-blue-500/10 hover:bg-blue-500/20"
          : isSelectedRight
          ? "bg-green-500/10 hover:bg-green-500/20"
          : "hover:bg-accent"
      )}
      onClick={() => onTableClick(table.TABLE_SCHEMA, table.TABLE_NAME)}
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
                className={cn(
                  "text-xs font-semibold px-1.5 py-0.5 mt-1 block",
                  isSelectedLeft
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                    : "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                )}
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
            ? "text-blue-700 dark:text-blue-300 border-blue-500/20"
            : hasError
            ? "text-red-700 dark:text-red-300 border-red-500/20"
            : isSuccess
            ? "text-green-700 dark:text-green-300 border-green-500/20"
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
        {hasStats && stats!.rowCount > 0
          ? stats!.rowCount.toLocaleString()
          : hasStats
          ? "0"
          : "-"}
      </TableCell>
      <TableCell
        className={cn(
          "w-[80px] min-w-[80px] max-w-[80px]",
          "text-right text-muted-foreground"
        )}
      >
        {hasStats && stats!.columnCount > 0
          ? stats!.columnCount
          : hasStats
          ? "0"
          : "-"}
      </TableCell>
      <TableCell
        className={cn(
          "w-[100px] min-w-[100px] max-w-[100px]",
          "text-right text-muted-foreground"
        )}
      >
        {hasStats && stats!.relationshipCount > 0
          ? stats!.relationshipCount
          : hasStats
          ? "0"
          : "-"}
      </TableCell>
      <TableCell
        className={cn(
          "w-[80px] min-w-[80px] max-w-[80px] sticky text-center justify-center items-center right-0 z-10 bg-white border-l",
          hasError
            ? "bg-red-50 dark:bg-red-950/20"
            : isSelectedLeft
            ? "bg-blue-500/10"
            : isSelectedRight
            ? "bg-green-500/10"
            : ""
        )}
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
          databaseName={databaseName}
          schema={table.TABLE_SCHEMA}
          table={table.TABLE_NAME}
          isTesting={isTesting}
          status={status}
          onStatusChange={(newStatus) =>
            onStatusChange(table.TABLE_SCHEMA, table.TABLE_NAME, newStatus)
          }
          onErrorChange={(hasError) =>
            onErrorChange(table.TABLE_SCHEMA, table.TABLE_NAME, hasError)
          }
          onTestingChange={(isTesting) =>
            onTestingChange(table.TABLE_SCHEMA, table.TABLE_NAME, isTesting)
          }
          onStatsUpdate={(partialStats) => {
            onStatsUpdate(table.TABLE_SCHEMA, table.TABLE_NAME, partialStats);
          }}
        />
        <TableStatsFetcher
          databaseName={databaseName}
          schema={table.TABLE_SCHEMA}
          table={table.TABLE_NAME}
          status={status}
          tables={tables}
          onStatsFetched={(fetchedStats) =>
            onStatsFetched(table.TABLE_SCHEMA, table.TABLE_NAME, fetchedStats)
          }
        />
      </TableCell>
    </TableRow>
  );
}

// Memoize to prevent unnecessary re-renders
export const TableRowItem = memo(TableRowItemComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.table.TABLE_SCHEMA === nextProps.table.TABLE_SCHEMA &&
    prevProps.table.TABLE_NAME === nextProps.table.TABLE_NAME &&
    prevProps.status === nextProps.status &&
    prevProps.isTesting === nextProps.isTesting &&
    prevProps.hasError === nextProps.hasError &&
    prevProps.isSelectedLeft === nextProps.isSelectedLeft &&
    prevProps.isSelectedRight === nextProps.isSelectedRight &&
    prevProps.hasStats === nextProps.hasStats &&
    prevProps.stats?.rowCount === nextProps.stats?.rowCount &&
    prevProps.stats?.columnCount === nextProps.stats?.columnCount &&
    prevProps.stats?.relationshipCount === nextProps.stats?.relationshipCount
  );
});

