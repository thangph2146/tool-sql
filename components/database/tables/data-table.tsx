"use client";

import { useRef } from "react";
import { Link2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  InputGroup,
  InputGroupInput,
  InputGroupButton,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { TableCell as TableCellComponent } from "./table-cell";
import { ReferenceColumnFilter } from "../filters";
import { normalizeColumnName } from "@/lib/utils/table-column-utils";
import { cn } from "@/lib/utils";
import type { DatabaseName } from "@/lib/db-config";
import type { ForeignKeyInfo } from "@/lib/hooks/use-database-query";

interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  filters: Record<string, string>;
  showFilters: boolean;
  relationships?: ForeignKeyInfo[];
  includeReferences?: boolean;
  databaseName: DatabaseName;
  schemaName: string;
  tableName: string;
  onFilterChange: (column: string, value: string) => void;
  onClearFilter: (column: string) => void;
  hasActiveFilters: boolean;
  duplicateIndexSet?: Set<number>;
  nameDuplicateIndexSet?: Set<number>;
  highlightedRow?: number | null;
  rowRefs?: React.MutableRefObject<Record<number, HTMLTableRowElement | null>>;
  debouncedFilterKey?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
}

export function DataTable({
  columns,
  rows,
  filters,
  showFilters,
  relationships = [],
  includeReferences = false,
  databaseName,
  schemaName,
  tableName,
  onFilterChange,
  onClearFilter,
  hasActiveFilters,
  duplicateIndexSet = new Set(),
  nameDuplicateIndexSet = new Set(),
  highlightedRow = null,
  rowRefs: externalRowRefs,
  debouncedFilterKey = "",
  containerClassName,
  style,
}: DataTableProps) {
  const internalRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const rowRefs = externalRowRefs || internalRowRefs;

  return (
    <Table
      key={`table-${debouncedFilterKey}-${rows.length}`}
      containerClassName={containerClassName}
      style={style}
    >
      <TableHeader>
        <TableRow>
          {columns.map((column) => {
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
                              onFilterChange(column, nextValue)
                            }
                            onClear={() => onClearFilter(column)}
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
                              onFilterChange(column, e.target.value)
                            }
                            className="text-xs"
                          />
                          {filterValue && (
                            <InputGroupAddon align="inline-end">
                              <InputGroupButton
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => onClearFilter(column)}
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
            const isDuplicateRow = duplicateIndexSet.has(rowIndex);
            const isNameDuplicate = nameDuplicateIndexSet.has(rowIndex);
            const isHighlighted = highlightedRow === rowIndex;
            return (
              <TableRow
                key={String(uniqueKey)}
                ref={(el) => {
                  rowRefs.current[rowIndex] = el;
                }}
                className={cn(
                  (isDuplicateRow || isNameDuplicate) &&
                    "ring-1 ring-amber-400 bg-amber-50/60",
                  isHighlighted && "ring-2 ring-primary"
                )}
              >
                {columns.map(
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
              colSpan={columns.length}
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
  );
}

