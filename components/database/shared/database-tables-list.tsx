"use client";

import { useMemo, useState } from "react";
import { Table, Loader2, RefreshCw, Filter, XCircle, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { DatabaseName } from "@/lib/db-config";
import { getDatabaseConfig } from "@/lib/db-config";
import { logger } from "@/lib/logger";
import { TableDataView } from "../tables/table-data-view";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
}

interface DatabaseTablesListProps {
  databaseName: DatabaseName;
  tables?: TableInfo[];
  isLoading: boolean;
  onRefresh: () => void;
  onCompareTable?: (table: { databaseName: DatabaseName; schema: string; table: string }) => void;
  selectedForComparison?: {
    left: { databaseName: DatabaseName; schema: string; table: string } | null;
    right: { databaseName: DatabaseName; schema: string; table: string } | null;
  };
}

export function DatabaseTablesList({
  databaseName,
  tables,
  isLoading,
  onRefresh,
  onCompareTable,
  selectedForComparison,
}: DatabaseTablesListProps) {
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    table: string;
  } | null>(null);
  const [filterText, setFilterText] = useState("");

  // Get database config to display actual database name
  const dbConfig = useMemo(
    () => getDatabaseConfig(databaseName),
    [databaseName]
  );

  // Filter tables based on filter text
  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (!filterText.trim()) return tables;

    const searchText = filterText.toLowerCase().trim();
    const filtered = tables.filter(
      (table) =>
        table.TABLE_NAME.toLowerCase().includes(searchText) ||
        table.TABLE_SCHEMA.toLowerCase().includes(searchText)
    );
    
    
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, filterText, databaseName]);

  // Memoize table count
  const tableCount = useMemo(() => tables?.length || 0, [tables]);
  const filteredCount = useMemo(() => filteredTables.length, [filteredTables]);

  // Memoize display name
  const displayName = useMemo(() => {
    return (
      dbConfig.displayName ||
      dbConfig.database ||
      databaseName.replace("_", " ").toUpperCase()
    );
  }, [dbConfig, databaseName]);

  const handleTableClick = (schema: string, table: string) => {
    logger.info('Table selected for viewing', {
      database: databaseName,
      schema,
      table,
    }, 'TABLE_LIST');
    setSelectedTable({ schema, table });
  };

  const handleCloseTableData = () => {
    setSelectedTable(null);
  };

  const handleClearFilter = () => {
    setFilterText("");
  };

  return (
    <div className="mt-4 pt-4">
      <Separator className="mb-4" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Tables in {displayName}
          </h3>
          {tables && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {tableCount} {tableCount === 1 ? "table" : "tables"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tables && !isLoading && (
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              title="Refresh tables list"
            >
              <RefreshCw />
              Refresh
            </Button>
          )}
          {!tables && !isLoading && (
            <Button onClick={onRefresh} variant="ghost" size="sm">
              Load Tables
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
        <div className="space-y-2">
          {/* Filter Input */}
          <div className="relative">
            <div className="relative bg-white">
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

          <ScrollArea className="max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-4">
              {filteredTables.length > 0 ? (
                filteredTables.map((table) => {
                  const isSelectedLeft =
                    selectedForComparison?.left?.databaseName === databaseName &&
                    selectedForComparison?.left?.schema === table.TABLE_SCHEMA &&
                    selectedForComparison?.left?.table === table.TABLE_NAME;
                  const isSelectedRight =
                    selectedForComparison?.right?.databaseName === databaseName &&
                    selectedForComparison?.right?.schema === table.TABLE_SCHEMA &&
                    selectedForComparison?.right?.table === table.TABLE_NAME;
                  const isSelected = isSelectedLeft || isSelectedRight;

                  return (
                    <div
                      key={`${table.TABLE_SCHEMA}.${table.TABLE_NAME}`}
                      className={`flex items-center gap-2 p-2 rounded-md border transition-colors group ${
                        isSelectedLeft
                          ? "bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20"
                          : isSelectedRight
                            ? "bg-green-500/10 border-green-500/50 hover:bg-green-500/20"
                            : "bg-background border-border hover:bg-accent hover:border-primary/50"
                      }`}
                    >
                    <div
                      onClick={() =>
                        handleTableClick(table.TABLE_SCHEMA, table.TABLE_NAME)
                      }
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      title={`Click to view data: ${table.TABLE_SCHEMA}.${table.TABLE_NAME} in ${databaseName}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-foreground truncate">
                            {table.TABLE_NAME}
                          </p>
                          {isSelected && (
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold px-1.5 py-0.5 ${
                                isSelectedLeft
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                  : "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                              }`}
                            >
                              {isSelectedLeft ? "1st" : "2nd"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Schema: {table.TABLE_SCHEMA}
                        </p>
                      </div>
                    </div>
                    {onCompareTable && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          logger.info('Table selected for comparison', {
                            database: databaseName,
                            schema: table.TABLE_SCHEMA,
                            table: table.TABLE_NAME,
                          }, 'TABLE_LIST');
                          onCompareTable({
                            databaseName,
                            schema: table.TABLE_SCHEMA,
                            table: table.TABLE_NAME,
                          });
                        }}
                        className={`h-6 w-6 transition-opacity ${
                          isSelected
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        }`}
                        title="Compare this table with another"
                      >
                        <GitCompare className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
                })
              ) : (
                <div className="col-span-2 text-center py-4">
                  <Table className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-muted-foreground">
                    No tables match &quot;{filterText}&quot;
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
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
          <Table className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
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
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

