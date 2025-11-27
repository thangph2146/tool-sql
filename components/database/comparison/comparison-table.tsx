"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Database, Filter, XCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { InputGroup, InputGroupInput, InputGroupButton, InputGroupAddon } from "@/components/ui/input-group";
import { TableCell as TableCellComponent } from "../tables/table-cell";
import { cn } from "@/lib/utils";
import type { UseTableFiltersReturn } from "@/lib/hooks/use-table-filters";
import { normalizeColumnName } from "@/lib/utils/table-column-utils";
import { logger } from "@/lib/logger";
import { ReferenceColumnFilter } from "../filters";
import { TableRelationshipsDialog } from "../tables/table-relationships-dialog";
import type { ForeignKeyInfo } from "@/lib/hooks/use-database-query";
import type { DuplicateGroup } from "@/lib/utils/data-quality-utils";
import { DataQualityAlert } from "../shared";

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
  onTableChange?: (schema: string, table: string) => void;
  duplicateGroups?: DuplicateGroup[];
  duplicateIndexSet?: Set<number>;
  redundantColumns?: string[];
  nameDuplicateGroups?: DuplicateGroup[];
  nameDuplicateIndexSet?: Set<number>;
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
  onTableChange,
  duplicateGroups = [],
  duplicateIndexSet,
  redundantColumns = [],
  nameDuplicateGroups = [],
  nameDuplicateIndexSet,
}: ComparisonTableProps) {
  const debouncedFilterKey = useMemo(() => {
    const activeFilters = Object.entries(filters.debouncedFilters || {})
      .filter(([, value]) => value?.trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([column, value]) => `${column}:${value}`)
      .join("|");
    return activeFilters || "no-filters";
  }, [filters.debouncedFilters]);
  const effectiveTotalRows = totalRows ?? rows.length;
  const effectiveFilteredRowCount =
    filteredRowCount ?? rows.length;

  const duplicateRowIndices = useMemo(() => {
    if (!duplicateIndexSet || duplicateIndexSet.size === 0) {
      return new Set<number>();
    }
    return new Set(duplicateIndexSet);
  }, [duplicateIndexSet]);
  const nameDuplicateRowIndices = useMemo(() => {
    if (!nameDuplicateIndexSet || nameDuplicateIndexSet.size === 0) {
      return new Set<number>();
    }
    return new Set(nameDuplicateIndexSet);
  }, [nameDuplicateIndexSet]);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrollToDuplicateRow = useCallback((index: number) => {
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
            <DataQualityAlert
              duplicateGroups={duplicateGroups}
              duplicateIndexSet={duplicateRowIndices}
              nameDuplicateGroups={nameDuplicateGroups}
              nameDuplicateIndexSet={nameDuplicateRowIndices}
              redundantColumns={redundantColumns}
              onRowNavigate={handleScrollToDuplicateRow}
            />
          </div>
          <div className="flex items-center gap-2">
            {includeReferences && (
              <TableRelationshipsDialog
                relationships={relationships}
                schemaName={schemaName}
                tableName={tableName}
                onTableChange={onTableChange}
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <Link2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Relationships</span>
                    {relationships.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {relationships.length}
                      </Badge>
                    )}
                  </Button>
                }
              />
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
                const diff = comparisonResult?.get(rowIndex);
                const isDuplicateRow = duplicateRowIndices.has(rowIndex);
                const isNameDuplicateRow = nameDuplicateRowIndices.has(rowIndex);
                const isHighlighted = highlightedRow === rowIndex;
                const isDifferent =
                  side === "left"
                    ? diff?.status === "different" || diff?.status === "left-only"
                    : diff?.status === "different" || diff?.status === "right-only";

                return (
                  <TableRow
                    key={String(uniqueKey)}
                    ref={(el) => {
                      rowRefs.current[rowIndex] = el;
                    }}
                    className={cn(
                      isDifferent && "bg-destructive/10 hover:bg-destructive/20",
                      (isDuplicateRow || isNameDuplicateRow) &&
                        "ring-1 ring-amber-400 bg-amber-50/80",
                      isHighlighted && "ring-2 ring-primary"
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

