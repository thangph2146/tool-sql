"use client";

import { useMemo, useState } from "react";
import { Database, Filter, XCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { InputGroup, InputGroupInput, InputGroupButton, InputGroupAddon } from "@/components/ui/input-group";
import { TableCell as TableCellComponent } from "@/components/database/table-cell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";
import type { UseTableFiltersReturn } from "@/lib/hooks/use-table-filters";
import { normalizeColumnName } from "@/lib/utils/table-column-utils";
import { logger } from "@/lib/logger";
import { ReferenceColumnFilter } from "@/components/database/reference-column-filter";

interface ForeignKeyInfo { 
  FK_NAME: string;
  FK_SCHEMA: string;
  FK_TABLE: string;
  FK_COLUMN: string;
  PK_SCHEMA: string;
  PK_TABLE: string;
  PK_COLUMN: string;
}

type ComparisonResultMap = Map<number, {
  leftRow?: Record<string, unknown>;
  rightRow?: Record<string, unknown>;
  status: "same" | "different" | "left-only" | "right-only";
  diffColumns?: string[];
}>;

interface ComparisonTableProps {
  databaseName: string;
  schemaName: string;
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  filters: UseTableFiltersReturn;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  comparisonResult?: ComparisonResultMap | null;
  side: "left" | "right";
  containerClassName?: string;
  relationships?: ForeignKeyInfo[];
  includeReferences?: boolean;
  totalRows?: number;
  filteredRowCount?: number;
}

export function ComparisonTable({
  databaseName,
  schemaName,
  tableName,
  columns,
  rows,
  filters,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  comparisonResult,
  side,
  containerClassName,
  relationships = [],
  includeReferences = false,
  totalRows,
  filteredRowCount,
}: ComparisonTableProps) {
  const debouncedFilterKey = useMemo(() => {
    const activeFilters = Object.entries(filters.debouncedFilters || {})
      .filter(([, value]) => value?.trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([column, value]) => `${column}:${value}`)
      .join("|");
    return activeFilters || "no-filters";
  }, [filters.debouncedFilters]);
  const [showRelationshipsDialog, setShowRelationshipsDialog] = useState(false);
  const effectiveTotalRows = totalRows ?? rows.length;
  const effectiveFilteredRowCount =
    filteredRowCount ?? rows.length;

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-2 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{databaseName}</span>
            <span className="text-xs text-muted-foreground">
              {schemaName}.{tableName}
            </span>
            <span className="text-xs text-muted-foreground">
              ({columns.length} columns)
            </span>
            {relationships.length > 0 && (
              <span className="text-xs text-muted-foreground">
                • {relationships.length} relationship{relationships.length > 1 ? 's' : ''}
              </span>
            )}
            {filters.hasActiveFilters && (
              <span className="text-xs text-muted-foreground">
                • Showing {effectiveFilteredRowCount} of {effectiveTotalRows} rows
                {effectiveFilteredRowCount !== effectiveTotalRows && (
                  <span className="text-primary"> (filtered)</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {relationships.length > 0 && (
              <Dialog open={showRelationshipsDialog} onOpenChange={setShowRelationshipsDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Link2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Relationships</span>
                    <Badge variant="secondary" className="ml-1">
                      {relationships.length}
                    </Badge>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                                <span className="font-semibold text-sm">{rel.FK_NAME}</span>
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">From:</span>
                                  <Badge variant="outline">
                                    {rel.FK_SCHEMA}.{rel.FK_TABLE}.{rel.FK_COLUMN}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">To:</span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logger.debug(
                  `Toggling filters for comparison table: ${schemaName}.${tableName} (${side} side)`,
                  {
                    database: databaseName,
                    schema: schemaName,
                    table: tableName,
                    side,
                    currentShowFilters: showFilters,
                    activeFilterCount,
                  },
                  'COMPARISON_TABLE_FILTER'
                );
                onToggleFilters();
              }}
            >
              <Filter className="h-3 w-3" />
              {filters.hasActiveFilters && (
                <Badge className="text-xs">{activeFilterCount}</Badge>
              )}
            </Button>
            {filters.hasActiveFilters && (
              <Button variant="destructive" size="sm" onClick={filters.handleClearFilters}>
                <XCircle className="h-3 w-3" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Table
          key={`comparison-table-${side}-${debouncedFilterKey}-${rows.length}`}
          containerClassName={containerClassName}
        >
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const hasRelationship = includeReferences && relationships.some(rel => 
                  normalizeColumnName(rel.FK_COLUMN) === normalizeColumnName(column)
                );
                return (
                  <TableHead key={column} className="font-semibold p-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span>{column}</span>
                        {hasRelationship && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
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
                          const filterValue = filters.filters[column] || "";

                          if (
                            hasRelationshipForColumn &&
                            includeReferences
                          ) {
                            return (
                              <ReferenceColumnFilter
                                databaseName={databaseName}
                                schemaName={schemaName}
                                tableName={tableName}
                                columnName={column}
                                includeReferences={includeReferences}
                                showFilters={showFilters}
                                hasRelationship={hasRelationshipForColumn}
                                filterValue={filterValue}
                                onChange={(nextValue) =>
                                  filters.handleFilterChange(column, nextValue)
                                }
                                onClear={() => filters.handleClearFilter(column)}
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
                                  filters.handleFilterChange(
                                    column,
                                    e.target.value
                                  )
                                }
                                className="text-xs"
                              />
                              {filterValue && (
                                <InputGroupAddon align="inline-end">
                                  <InputGroupButton
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() =>
                                      filters.handleClearFilter(column)
                                    }
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
              {rows.length > 0 ? (
              rows.map((row, rowIndex) => {
                const firstColumn = columns[0];
                const uniqueKey =
                  row["Oid"] ??
                  row["Id"] ??
                  (firstColumn ? row[`${firstColumn}_OriginalId`] : undefined) ??
                  (firstColumn ? row[firstColumn] : undefined) ??
                  `${rowIndex}-${debouncedFilterKey}`;
                const diff = comparisonResult?.get(rowIndex);
                const isDifferent =
                  side === "left"
                    ? diff?.status === "different" || diff?.status === "left-only"
                    : diff?.status === "different" || diff?.status === "right-only";

                return (
                  <TableRow
                    key={String(uniqueKey)}
                    className={cn(
                      isDifferent && "bg-destructive/10 hover:bg-destructive/20"
                    )}
                  >
                    {columns.map((column) => {
                      const isDiffColumn = diff?.diffColumns?.includes(column);
                      return (
                        <TableCell
                          key={column}
                          className={cn(
                            "max-w-xs p-2 text-xs",
                            isDiffColumn && "bg-destructive/20 font-semibold"
                          )}
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
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  {filters.hasActiveFilters
                    ? "No rows match the current filters"
                    : "No data"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

