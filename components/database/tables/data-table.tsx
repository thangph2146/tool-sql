"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
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
import { SingleSelectCombobox } from "../filters/single-select-combobox";
import { useColumnFilterOptions } from "@/lib/hooks/use-column-filter-options";
import { normalizeColumnName } from "@/lib/utils/table-column-utils";
import { cn } from "@/lib/utils";
import type { DatabaseName } from "@/lib/db-config";
import type { ForeignKeyInfo } from "@/lib/hooks/use-database-query";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useFlowLoggerWithKey } from "@/lib/hooks/use-flow-logger";
import { FLOW_NAMES } from "@/lib/constants/flow-constants";
import type { DuplicateGroup } from "@/lib/utils/data-quality-utils";

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

  // Flow logging
  const tableKey = `${databaseName}_${schemaName}_${tableName}`;
  const { flowLog } = useFlowLoggerWithKey(
    tableKey,
    () => FLOW_NAMES.TABLE_DATA_VIEW(databaseName, schemaName, tableName),
    () => ({
      database: databaseName,
      schema: schemaName,
      table: tableName,
    })
  );

  // Sort state - array of {column, order}
  type SortConfig = { column: string; order: "alphabetical" | "reverse" | "newest" | "oldest" };
  const [sortColumns, setSortColumns] = useState<SortConfig[]>([]);

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    setSortColumns((prev) => {
      const existingIndex = prev.findIndex((s) => s.column === column);
      if (existingIndex >= 0) {
        // Remove if already exists
        return prev.filter((_, i) => i !== existingIndex);
      } else {
        // Add new column with default alphabetical sort
        return [...prev, { column, order: "alphabetical" }];
      }
    });
  };

  // Handle sort order change for a specific column
  const handleSortOrderChange = (column: string, order: "alphabetical" | "reverse" | "newest" | "oldest") => {
    setSortColumns((prev) =>
      prev.map((s) => (s.column === column ? { ...s, order } : s))
    );
  };

  // Remove sort for a column
  const handleRemoveSort = (column: string) => {
    setSortColumns((prev) => prev.filter((s) => s.column !== column));
  };

  // Sort rows based on multiple sortColumns
  // Also create a mapping from original index to sorted index
  const sortedRowsData = useMemo(() => {
    if (sortColumns.length === 0) {
      // No sorting, create identity map
      const identityMap = new Map<number, number>();
      rows.forEach((_, index) => identityMap.set(index, index));
      return { sortedRows: rows, originalToSortedIndexMap: identityMap };
    }

    // Create array with original indices
    const rowsWithIndices = rows.map((row, originalIndex) => ({
      row,
      originalIndex,
    }));

    // Sort with original indices preserved
    const sorted = rowsWithIndices.sort((a, b) => {
      // Sort by each column in order
      for (const { column, order } of sortColumns) {
        const aValue = a.row[column];
        const bValue = b.row[column];

        // Handle null/undefined values
        if (aValue == null && bValue == null) continue;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        let comparison = 0;

        // Try date comparison first (for date columns)
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime()) && aDate.getTime() !== 0 && bDate.getTime() !== 0) {
          // Valid dates
          comparison = aDate.getTime() - bDate.getTime();
        } else {
          // Try numeric comparison
          const aNum = Number(aValue);
          const bNum = Number(bValue);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            comparison = aNum - bNum;
          } else {
            // String comparison
            const aStr = String(aValue).toLowerCase();
            const bStr = String(bValue).toLowerCase();
            comparison = aStr.localeCompare(bStr, 'vi', { numeric: true, sensitivity: 'base' });
          }
        }

        // Apply sort order
        if (order === "reverse") {
          // Reverse = Z-A (ngược)
          comparison = -comparison;
        } else if (order === "newest") {
          // Newest = lớn nhất/cuối cùng lên đầu (reverse)
          comparison = -comparison;
        } else if (order === "oldest") {
          // Oldest = nhỏ nhất/đầu tiên lên đầu (normal)
          // Keep original comparison
        }
        // "alphabetical" keeps original comparison

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }
        // If equal, continue to next sort column
      }
      return 0;
    });

    // Extract sorted rows and create mapping
    const sortedRowsResult = sorted.map(item => item.row);
    const indexMap = new Map<number, number>();
    sorted.forEach((item, sortedIndex) => {
      indexMap.set(item.originalIndex, sortedIndex);
    });

    return { sortedRows: sortedRowsResult, originalToSortedIndexMap: indexMap };
  }, [rows, sortColumns]);

  const sortedRows = sortedRowsData.sortedRows;
  const originalToSortedIndexMap = sortedRowsData.originalToSortedIndexMap;

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

  // Log when rows are filtered/sorted
  useEffect(() => {
    if (flowLog && rows.length > 0 && sortedRows.length > 0) {
      const activeFiltersList = Object.entries(filters)
        .filter(([, v]) => v?.trim() !== "")
        .map(([col, val]) => ({ column: col, value: val }));
      
      const firstRow = sortedRows[0];
      const firstRowKeys = Object.keys(firstRow);
      
      // Get data types and sample values for first 10 columns
      const dataTypes = columns.slice(0, 10).map((col) => {
        const value = firstRow[col];
        return {
          column: col,
          type: value !== null && value !== undefined ? typeof value : "null",
          sampleValue:
            value !== null && value !== undefined
              ? String(value).length > 50
                ? String(value).substring(0, 50) + "..."
                : String(value)
              : null,
        };
      });
      
      flowLog.debug("Data table filtered/sorted", {
        totalRows: rows.length,
        sortedRowsCount: sortedRows.length,
        sortColumns: sortColumns.map(s => ({ column: s.column, order: s.order })),
        hasActiveFilters: activeFiltersList.length > 0,
        activeFilters: activeFiltersList,
        firstRowKeys,
        dataTypes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowLog, rows.length, sortedRows.length, sortColumns, filters, columns]);

  // Component for column filter with options
  const ColumnFilterSelect = ({
    databaseName,
    schemaName,
    tableName,
    columnName,
    value,
    onChange,
    onClear,
  }: {
    databaseName: DatabaseName;
    schemaName: string;
    tableName: string;
    columnName: string;
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
  }) => {
    const [hasOpened, setHasOpened] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 300);

    // Load options when opened
    const enabled = showFilters && hasOpened;
    const { data: optionsData, isLoading } = useColumnFilterOptions(
      {
        databaseName,
        schemaName,
        tableName,
        columnName,
        includeReferences: false,
        search: debouncedSearch,
      },
      enabled
    );

    const options = optionsData?.data.values ?? [];

    return (
      <SingleSelectCombobox
        options={options}
        value={value}
        placeholder="Chọn giá trị..."
        loading={isLoading && !debouncedSearch.trim()}
        onChange={(val) => {
          onChange(val);
          setSearchTerm("");
        }}
        onClear={() => {
          onClear();
          setSearchTerm("");
        }}
        onSearchChange={(search) => {
          setSearchTerm(search);
        }}
        onOpenChange={(isOpen) => {
          if (isOpen && !hasOpened) {
            setHasOpened(true);
          }
          if (!isOpen) {
            setSearchTerm("");
          }
        }}
      />
    );
  };

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

