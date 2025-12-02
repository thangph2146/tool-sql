"use client";

import { useRef, useState, useMemo, useCallback, memo } from "react";
import { Link2, ArrowUpDown, X, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { TableCell as TableCellComponent } from "./table-cell";
import { ReferenceColumnFilter } from "../filters";
import { ColumnFilterSelect } from "./column-filter-select";
import { normalizeColumnName } from "@/lib/utils/table-column-utils";
import { cn } from "@/lib/utils";
import type { DatabaseName } from "@/lib/db-config";
import type { ForeignKeyInfo } from "@/lib/hooks/use-database-query";
import type { DuplicateGroup } from "@/lib/utils/data-quality-utils";
import { useTableSorting } from "@/lib/hooks/use-table-sorting";

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
  duplicateGroups?: DuplicateGroup[];
  nameDuplicateGroups?: DuplicateGroup[];
  highlightedRow?: number | null;
  rowRefs?: React.MutableRefObject<Record<number, HTMLTableRowElement | null>>;
  debouncedFilterKey?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
}

function DataTableComponent({
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
  duplicateGroups = [],
  nameDuplicateGroups = [],
  highlightedRow = null,
  rowRefs: externalRowRefs,
  debouncedFilterKey = "",
  containerClassName,
  style,
}: DataTableProps) {
  const internalRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const rowRefs = externalRowRefs || internalRowRefs;

  // State to track expanded duplicate groups
  const [expandedDuplicateGroups, setExpandedDuplicateGroups] = useState<Set<string>>(new Set());

  // Note: Flow logging is handled by parent component (TableDataView)
  // No need to create duplicate flow logs here

  // Use custom hook for sorting
  const {
    sortColumns,
    handleSort,
    handleSortOrderChange,
    handleRemoveSort,
    sortedRows,
    originalToSortedIndexMap,
  } = useTableSorting(rows);

  // Map duplicate indices from original to sorted
  const duplicateRowIndices = useMemo(() => {
    if (!duplicateIndexSet || duplicateIndexSet.size === 0) {
      return new Set<number>();
    }
    const sortedIndices = new Set<number>();
    duplicateIndexSet.forEach(originalIdx => {
      const sortedIdx = originalToSortedIndexMap.get(originalIdx);
      if (sortedIdx !== undefined) {
        sortedIndices.add(sortedIdx);
      }
    });
    return sortedIndices;
  }, [duplicateIndexSet, originalToSortedIndexMap]);

  const nameDuplicateRowIndices = useMemo(() => {
    if (!nameDuplicateIndexSet || nameDuplicateIndexSet.size === 0) {
      return new Set<number>();
    }
    const sortedIndices = new Set<number>();
    nameDuplicateIndexSet.forEach(originalIdx => {
      const sortedIdx = originalToSortedIndexMap.get(originalIdx);
      if (sortedIdx !== undefined) {
        sortedIndices.add(sortedIdx);
      }
    });
    return sortedIndices;
  }, [nameDuplicateIndexSet, originalToSortedIndexMap]);

  // Group rows by duplicate groups for collapse/expand
  // Map original indices to sorted indices
  const groupedRows = useMemo(() => {
    const groups: Map<string, { parentIndex: number; childIndices: number[] }> = new Map();
    const processedIndices = new Set<number>();
    
    // Process duplicate groups - map original indices to sorted indices
    duplicateGroups.forEach((group) => {
      if (group.indices.length > 1) {
        // Map original indices to sorted indices
        const sortedIndices = group.indices
          .map(originalIdx => originalToSortedIndexMap.get(originalIdx))
          .filter((idx): idx is number => idx !== undefined)
          .sort((a, b) => a - b); // Sort to ensure parent is first
        
        if (sortedIndices.length > 1) {
          const parentIndex = sortedIndices[0];
          const childIndices = sortedIndices.slice(1);
          groups.set(group.signature, { parentIndex, childIndices });
          sortedIndices.forEach(idx => processedIndices.add(idx));
        }
      }
    });
    
    // Process name duplicate groups - map original indices to sorted indices
    nameDuplicateGroups.forEach((group) => {
      if (group.indices.length > 1) {
        const signature = `name_${group.signature}`;
        if (!groups.has(signature)) {
          // Map original indices to sorted indices
          const sortedIndices = group.indices
            .map(originalIdx => originalToSortedIndexMap.get(originalIdx))
            .filter((idx): idx is number => idx !== undefined)
            .sort((a, b) => a - b); // Sort to ensure parent is first
          
          if (sortedIndices.length > 1) {
            const parentIndex = sortedIndices[0];
            const childIndices = sortedIndices.slice(1);
            groups.set(signature, { parentIndex, childIndices });
            sortedIndices.forEach(idx => processedIndices.add(idx));
          }
        }
      }
    });
    
    return { groups, processedIndices };
  }, [duplicateGroups, nameDuplicateGroups, originalToSortedIndexMap]);

  // Toggle expand/collapse for duplicate group
  const toggleDuplicateGroup = useCallback((signature: string) => {
    setExpandedDuplicateGroups((prev) => {
      const next = new Set(prev);
      if (next.has(signature)) {
        next.delete(signature);
      } else {
        next.add(signature);
      }
      return next;
    });
  }, []);

  // Note: Flow logging is handled by parent component (TableDataView)
  // Removed duplicate logging here to improve performance

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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-5 w-5 ml-auto"
                      onClick={() => handleSort(column)}
                      type="button"
                      aria-label={`Sort by ${column}`}
                    >
                      <ArrowUpDown className={cn("h-3 w-3", sortColumns.some(s => s.column === column) ? "opacity-100" : "opacity-50")} />
                    </Button>
                    {sortColumns.some(s => s.column === column) && (
                      <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                        {sortColumns.findIndex(s => s.column === column) + 1}
                      </Badge>
                    )}
                  </div>
                  {sortColumns.some(s => s.column === column) && (() => {
                    const sortConfig = sortColumns.find(s => s.column === column);
                    return (
                      <div className="flex items-center gap-2 mt-1">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Sắp xếp:</Label>
                        <Select 
                          value={sortConfig?.order || "alphabetical"} 
                          onValueChange={(value: "alphabetical" | "reverse" | "newest" | "oldest") => handleSortOrderChange(column, value)}
                        >
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alphabetical">Chữ cái xuôi</SelectItem>
                            <SelectItem value="reverse">Chữ cái ngược</SelectItem>
                            <SelectItem value="newest">Mới nhất</SelectItem>
                            <SelectItem value="oldest">Cũ nhất</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-5 w-5"
                          onClick={() => handleRemoveSort(column)}
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })()}
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
                        <ColumnFilterSelect
                          databaseName={databaseName}
                          schemaName={schemaName}
                          tableName={tableName}
                          columnName={column}
                          value={filterValue}
                          showFilters={showFilters}
                          onChange={(value) => onFilterChange(column, value)}
                          onClear={() => onClearFilter(column)}
                        />
                      );
                    })()}
                </div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.length > 0 ? (
          (() => {
            const renderedRows: React.ReactNode[] = [];
            const processedIndices = new Set<number>();
            
            sortedRows.forEach((row, rowIndex) => {
              // Skip if already processed as child row
              if (processedIndices.has(rowIndex)) {
                return;
              }
              
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
              const isDuplicateRow = duplicateRowIndices.has(rowIndex);
              const isNameDuplicate = nameDuplicateRowIndices.has(rowIndex);
              const isHighlighted = highlightedRow === rowIndex;

              // Check if this row is a parent of a duplicate group
              let duplicateGroupInfo: { signature: string; childIndices: number[] } | null = null;
              for (const [signature, group] of groupedRows.groups.entries()) {
                if (group.parentIndex === rowIndex) {
                  duplicateGroupInfo = { signature, childIndices: group.childIndices };
                  break;
                }
              }
              
              const isExpanded = duplicateGroupInfo ? expandedDuplicateGroups.has(duplicateGroupInfo.signature) : false;
              const childCount = duplicateGroupInfo ? duplicateGroupInfo.childIndices.length : 0;
              
              const uniqueRowKey = `${String(uniqueKey)}-${rowIndex}`;
              
              // Render parent row
              renderedRows.push(
                <TableRow
                  key={uniqueRowKey}
                  ref={(el) => {
                    rowRefs.current[rowIndex] = el;
                  }}
                  className={cn(
                    (isDuplicateRow || isNameDuplicate) &&
                      "ring-1 ring-amber-400 bg-amber-50/60",
                    isHighlighted && "ring-2 ring-primary"
                  )}
                >
                  {columns.map((column, colIndex) => {
                    const isFirstColumn = colIndex === 0;
                    const showExpandButton = isFirstColumn && duplicateGroupInfo && childCount > 0;
                    
                    return (
                      <TableCell key={column} className="max-w-xs">
                        <div className="flex items-center gap-1">
                          {showExpandButton && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-4 w-4 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (duplicateGroupInfo) {
                                  toggleDuplicateGroup(duplicateGroupInfo.signature);
                                }
                              }}
                              type="button"
                              aria-label={isExpanded ? "Collapse duplicates" : "Expand duplicates"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          {showExpandButton && !isExpanded && (
                            <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                              +{childCount}
                            </Badge>
                          )}
                          <TableCellComponent value={row[column]} />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
              
              // Mark parent as processed
              processedIndices.add(rowIndex);
              
              // If collapsed, mark all child indices as processed to skip them
              if (duplicateGroupInfo && !isExpanded) {
                duplicateGroupInfo.childIndices.forEach((childIndex) => {
                  processedIndices.add(childIndex);
                });
              }
              
              // Render child rows if expanded
              if (duplicateGroupInfo && isExpanded) {
                duplicateGroupInfo.childIndices.forEach((childIndex) => {
                  if (childIndex < sortedRows.length) {
                    const childRow = sortedRows[childIndex];
                    const childFirstColumn = columns[0];
                    const childPrimaryOriginalId =
                      childFirstColumn && childRow[`${childFirstColumn}_OriginalId`];
                    const childFallbackOriginalId = childRow["Oid_OriginalId"];
                    const childUniqueKey =
                      childPrimaryOriginalId ??
                      childFallbackOriginalId ??
                      childRow["Id"] ??
                      childRow["Oid"] ??
                      (childFirstColumn ? childRow[childFirstColumn] : undefined) ??
                      `${childIndex}-${debouncedFilterKey}`;
                    const childIsDuplicateRow = duplicateRowIndices.has(childIndex);
                    const childIsNameDuplicate = nameDuplicateRowIndices.has(childIndex);
                    const childIsHighlighted = highlightedRow === childIndex;
                    
                    const childUniqueRowKey = `${String(childUniqueKey)}-${childIndex}`;
                    
                    renderedRows.push(
                      <TableRow
                        key={childUniqueRowKey}
                        ref={(el) => {
                          rowRefs.current[childIndex] = el;
                        }}
                        className={cn(
                          "bg-muted/30",
                          (childIsDuplicateRow || childIsNameDuplicate) &&
                            "ring-1 ring-amber-400 bg-amber-50/80",
                          childIsHighlighted && "ring-2 ring-primary"
                        )}
                      >
                        {columns.map((column, colIndex) => (
                          <TableCell
                            key={column}
                            className={cn(
                              "max-w-xs",
                              colIndex === 0 && "pl-8"
                            )}
                          >
                            <TableCellComponent value={childRow[column]} />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                    
                    processedIndices.add(childIndex);
                  }
                });
              }
            });
            
            return renderedRows;
          })()
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

// Memoize DataTable to prevent unnecessary re-renders
export const DataTable = memo(DataTableComponent);

