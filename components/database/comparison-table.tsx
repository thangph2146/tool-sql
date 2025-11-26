"use client";

import { useMemo } from "react";
import { Database, Filter, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { InputGroup, InputGroupInput, InputGroupButton, InputGroupAddon } from "@/components/ui/input-group";
import { TableCell as TableCellComponent } from "@/components/database/table-cell";
import { cn } from "@/lib/utils";
import type { UseTableFiltersReturn } from "@/lib/hooks/use-table-filters";

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
  filters: UseTableFiltersReturn<Record<string, unknown>>;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  comparisonResult?: ComparisonResultMap | null;
  side: "left" | "right";
  containerClassName?: string;
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
}: ComparisonTableProps) {
  const filteredRows = useMemo(() => filters.filteredRows, [filters.filteredRows]);

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
            {filters.hasActiveFilters && (
              <span className="text-xs text-muted-foreground">
                • Showing {filters.filteredRowCount} of {rows.length} rows
                {filters.filteredRowCount !== rows.length && (
                  <span className="text-primary"> (filtered)</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onToggleFilters}>
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
        <Table containerClassName={containerClassName}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="font-semibold p-2 text-xs">
                  <div className="flex flex-col gap-1">
                    <span>{column}</span>
                    {showFilters && (
                      <InputGroup className="h-7">
                        <InputGroupInput
                          type="text"
                          placeholder="Filter..."
                          value={filters.filters[column] || ""}
                          onChange={(e) => filters.handleFilterChange(column, e.target.value)}
                          className="text-xs"
                        />
                        {filters.filters[column] && (
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => filters.handleClearFilter(column)}
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
              filteredRows.map((row, rowIndex) => {
                const diff = comparisonResult?.get(rowIndex);
                const isDifferent =
                  side === "left"
                    ? diff?.status === "different" || diff?.status === "left-only"
                    : diff?.status === "different" || diff?.status === "right-only";

                return (
                  <TableRow
                    key={rowIndex}
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

