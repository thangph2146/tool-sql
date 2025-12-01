"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Database, Filter, XCircle, Link2, Loader2, ArrowUpDown, X, ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TableCell as TableCellComponent } from "../tables/table-cell";
import { cn } from "@/lib/utils";
import type { UseTableFiltersReturn } from "@/lib/hooks/use-table-filters";
import { normalizeColumnName } from "@/lib/utils/table-column-utils";
import { ReferenceColumnFilter } from "../filters";
import { SingleSelectCombobox } from "../filters/single-select-combobox";
import { useColumnFilterOptions } from "@/lib/hooks/use-column-filter-options";
import type { ForeignKeyInfo } from "@/lib/hooks/use-database-query";
import type { DuplicateGroup } from "@/lib/utils/data-quality-utils";
import { DataQualityAlert, TableRelationshipsDialog } from "../shared";
import { TABLE_LIMIT_OPTIONS } from "@/lib/constants/table-constants";
import type { CombinedColumn } from "./column-selector";
import { getColumnValue } from "@/lib/utils/combined-column-utils";
import { logger } from "@/lib/logger";
import { isNullRow } from "@/lib/utils/table-comparison-utils";

type FlowLogger = ReturnType<typeof logger.createFlowLogger>;

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
  limit?: number;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  pagination?: {
    page: number;
    setPage: (page: number) => void;
    pageInput: string;
    offset: number;
    currentPage: number;
    totalPages: number;
    handlePrevious: () => void;
    handleNext: () => void;
    handleFirstPage: () => void;
    handleLastPage: () => void;
    handlePageInputChange: (value: string) => void;
    handlePageInputSubmit: () => void;
    handlePageInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    handleLimitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  };
  onTableChange?: (schema: string, table: string) => void;
  duplicateGroups?: DuplicateGroup[];
  duplicateIndexSet?: Set<number>;
  redundantColumns?: string[];
  nameDuplicateGroups?: DuplicateGroup[];
  nameDuplicateIndexSet?: Set<number>;
  combinedColumns?: CombinedColumn[];
  columnsToCompare?: string[];
  flowLog?: FlowLogger | null;
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
  limit,
  onLimitChange,
  isLoading = false,
  hasMore,
  pagination,
  onTableChange,
  duplicateGroups = [],
  duplicateIndexSet,
  redundantColumns = [],
  nameDuplicateGroups = [],
  nameDuplicateIndexSet,
  combinedColumns = [],
  columnsToCompare = [],
  flowLog,
}: ComparisonTableProps) {
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
  // IMPORTANT: When columnsToCompare is not empty, rows are already synchronized
  // Sorting should be disabled or only allowed on columnsToCompare to maintain synchronization
  const sortedRowsData = useMemo(() => {
    // If columnsToCompare is not empty, disable sorting to maintain row synchronization
    // Rows are already aligned by comparison key, sorting would break the alignment
    if (columnsToCompare.length > 0) {
      // No sorting when rows are synchronized, create identity map
      const identityMap = new Map<number, number>();
      rows.forEach((_, index) => identityMap.set(index, index));
      return { sortedRows: rows, originalToSortedIndexMap: identityMap };
    }
    
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
        // Handle combined columns
        const aValue = getColumnValue(a.row, column, combinedColumns);
        const bValue = getColumnValue(b.row, column, combinedColumns);

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
  }, [rows, sortColumns, combinedColumns, columnsToCompare.length]);

  const sortedRows = sortedRowsData.sortedRows;
  const originalToSortedIndexMap = sortedRowsData.originalToSortedIndexMap;

  // Reset sorting when columnsToCompare changes from empty to non-empty
  // This ensures rows remain synchronized when comparison is active
  useEffect(() => {
    if (columnsToCompare.length > 0 && sortColumns.length > 0) {
      setSortColumns([]);
    }
  }, [columnsToCompare.length, sortColumns.length]);

  // Log filtered/sorted data
  useEffect(() => {
    if (flowLog && rows.length > 0 && columns.length > 0) {
      const activeFiltersList = Object.entries(filters.debouncedFilters || {})
        .filter(([, v]) => v?.trim() !== "")
        .map(([col, val]) => ({ column: col, value: val }));

      // Get first row keys and data types with sample values
      const firstRowKeys = Object.keys(sortedRows[0] || {});
      const dataTypes = columns.slice(0, 10).map((col) => {
        const firstValue = sortedRows[0]?.[col];
        const actualValue = extractActualValue(firstValue);
        // For display in logs, convert to string but preserve object info
        let sampleValue: string | null = null;
        if (actualValue !== null && actualValue !== undefined) {
          if (
            typeof actualValue === "object" &&
            actualValue !== null &&
            "type" in actualValue &&
            actualValue.type === "Buffer" &&
            "data" in actualValue &&
            Array.isArray(actualValue.data)
          ) {
            sampleValue = `[Buffer - ${(actualValue.data as number[]).length} bytes]`;
          } else {
            const strValue = String(actualValue);
            sampleValue = strValue.length > 50 ? strValue.substring(0, 50) + "..." : strValue;
          }
        }
        return {
          column: col,
          type:
            actualValue !== null && actualValue !== undefined
              ? typeof actualValue
              : "null",
          sampleValue,
        };
      });

      flowLog.debug(`${side === "left" ? "Left" : "Right"} table filtered/sorted`, {
        totalRows: rows.length,
        sortedRowsCount: sortedRows.length,
        sortColumns: sortColumns.map(s => ({ column: s.column, order: s.order })),
        hasActiveFilters: activeFiltersList.length > 0,
        activeFilters: activeFiltersList,
        firstRowKeys: firstRowKeys,
        dataTypes: dataTypes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowLog, rows.length, sortedRows.length, sortColumns, filters.debouncedFilters, columns, side]);

  // Extract actual value from display value (removes "\n(ID: ...)" part)
  // But preserve object/Buffer values for image rendering
  const extractActualValue = (value: unknown): unknown => {
    if (value === null || value === undefined) {
      return value;
    }
    
    // Preserve objects (including Buffer objects for images)
    if (typeof value === "object") {
      return value;
    }
    
    // Only process strings
    if (typeof value !== "string") {
      return value;
    }
    
    // Check if value contains "\n(ID: " pattern (display value with ID)
    const idPattern = /\n\(ID:\s*[^)]+\)/;
    if (idPattern.test(value)) {
      // Extract only the part before "\n(ID: "
      return value.split('\n(ID:')[0].trim();
    }
    
    // Also check for pattern without newline: "(ID: ...)" at the end
    const idPatternEnd = /\(ID:\s*[^)]+\)$/;
    if (idPatternEnd.test(value)) {
      return value.replace(idPatternEnd, '').trim();
    }
    
    return value;
  };

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
    databaseName: string;
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

    // Check if this is a combined column
    const isCombinedColumn = combinedColumns?.some(c => c.name === columnName);

    // For combined columns, get options from rows (client-side)
    const combinedColumnOptions = useMemo(() => {
      if (!isCombinedColumn || rows.length === 0) {
        return [];
      }
      
      // Extract unique actual values from rows
      const uniqueValues = new Set<string>();
      rows.forEach(row => {
        const cellValue = getColumnValue(row, columnName, combinedColumns);
        const actualValue = extractActualValue(cellValue);
        // Only add string values to filter options (skip objects/Buffers)
        if (typeof actualValue === "string" && actualValue.trim()) {
          uniqueValues.add(actualValue.trim());
        }
      });
      
      // Sort and filter by search term
      let options = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
      
      if (debouncedSearch.trim()) {
        const searchLower = debouncedSearch.toLowerCase();
        options = options.filter(opt => opt.toLowerCase().includes(searchLower));
      }
      
      return options;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCombinedColumn, rows.length, columnName, combinedColumns?.length, debouncedSearch]);

    // Load options from API for regular columns
    const enabled = showFilters && hasOpened && !isCombinedColumn;
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

    // Use combined column options if it's a combined column, otherwise use API options
    const options = isCombinedColumn ? combinedColumnOptions : (optionsData?.data.values ?? []);

    return (
      <SingleSelectCombobox
        options={options}
        value={value}
        placeholder="Chọn giá trị..."
        loading={isLoading && !debouncedSearch.trim() && !isCombinedColumn}
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
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // State to track expanded duplicate groups
  const [expandedDuplicateGroups, setExpandedDuplicateGroups] = useState<Set<string>>(new Set());

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

  const handleLimitChange = useCallback((value: string) => {
    const newLimit = parseInt(value, 10);
    onLimitChange?.(newLimit);
  }, [onLimitChange]);

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
            <br/>
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
            {limit !== undefined && onLimitChange && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <Select
                  value={String(limit)}
                  onValueChange={handleLimitChange}
                >
                  <SelectTrigger size="sm" className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_LIMIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={String(opt)}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Loading {side} table...
              </span>
            </div>
          </div>
        )}
        <Table
          key={`comparison-table-${side}-${debouncedFilterKey}-${rows.length}-${columns.length}`}
          containerClassName={containerClassName}
        >
          <TableHeader>
            <TableRow>
              {/* STT column header */}
              {!isLoading || columns.length > 0 ? (
                <TableHead className="font-semibold p-2 text-xs w-[100px] min-w-[100px] max-w-[100px] sticky left-0 bg-background z-10 border-r">
                  <div className="flex items-center justify-center gap-1">
                    <span>STT</span>
                  </div>
                </TableHead>
              ) : null}
              {isLoading && columns.length === 0 ? (
                <TableHead colSpan={1} className="font-semibold p-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span>Đang tải cột...</span>
                  </div>
                </TableHead>
              ) : columns.length > 0 ? columns.map((column) => {
                const hasRelationship = includeReferences && relationships.some(rel => 
                  normalizeColumnName(rel.FK_COLUMN) === normalizeColumnName(column)
                );
                const isCombinedColumn = combinedColumns?.some(c => c.name === column);
                return (
                  <TableHead key={column} className="font-semibold p-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span>
                          {column}
                          {isCombinedColumn && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (kết hợp)
                            </span>
                          )}
                        </span>
                        {hasRelationship && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
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
                          disabled={columnsToCompare.length > 0}
                          title={columnsToCompare.length > 0 ? "Không thể sắp xếp khi đang so sánh để giữ đồng bộ hàng" : "Sắp xếp"}
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
                            <ColumnFilterSelect
                              databaseName={databaseName}
                              schemaName={schemaName}
                              tableName={tableName}
                              columnName={column}
                              value={filterValue}
                              onChange={(value) =>
                                filters.handleFilterChange(column, value)
                              }
                              onClear={() => filters.handleClearFilter(column)}
                            />
                          );
                        })()}
                    </div>
                  </TableHead>
                );
              }) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Đang tải dữ liệu...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedRows.length > 0 ? (
              (() => {
                const renderedRows: React.ReactNode[] = [];
                const processedIndices = new Set<number>();
                
                sortedRows.forEach((row, rowIndex) => {
                  // Skip if already processed as child row
                  if (processedIndices.has(rowIndex)) {
                    return;
                  }
                  
                  // Check if this is a null row (padded row for synchronization)
                  const isNull = isNullRow(row, columns.length > 0 ? columns : Object.keys(row));
                  
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
                  
                  // Ensure unique key by adding rowIndex to prevent duplicate keys
                  const uniqueRowKey = `${String(uniqueKey)}-${rowIndex}`;
                  
                  // Render parent row
                  renderedRows.push(
                    <TableRow
                      key={uniqueRowKey}
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
                      {/* STT cell */}
                      <TableCell className="font-medium p-2 text-xs w-[100px] min-w-[100px] max-w-[100px] sticky left-0 bg-background z-10 border-r text-center">
                        {(pagination?.offset ?? 0) + rowIndex + 1}
                      </TableCell>
                      {columns.map((column, colIndex) => {
                        const isDiffColumn = diff?.diffColumns?.includes(column);
                        // Check if this is a combined column
                        const combined = combinedColumns.find(c => c.name === column);
                        const rawValue = combined 
                          ? getColumnValue(row, column, combinedColumns)
                          : row[column];
                        
                        // Extract actual value from display value for display
                        const cellValue = extractActualValue(rawValue);
                        
                        // First column: add expand/collapse button for duplicate groups
                        const isFirstColumn = colIndex === 0;
                        const showExpandButton = isFirstColumn && duplicateGroupInfo && childCount > 0;
                        
                        // Determine cell comparison status for coloring
                        // Only apply colors if column is being compared
                        const isColumnCompared = columnsToCompare.length > 0 && columnsToCompare.includes(column);
                        let cellStatus: "same" | "different" | "duplicate" | "none" = "none";
                        
                        if (diff && isColumnCompared) {
                          if (diff.status === "same" && !isDiffColumn) {
                            // Column matches between left and right
                            cellStatus = "same";
                          } else if (isDiffColumn) {
                            // Column value is different
                            cellStatus = "different";
                          } else if (diff.status === "left-only" || diff.status === "right-only") {
                            // Row exists only in one table (duplicate/extra)
                            cellStatus = "duplicate";
                          }
                        } else if (diff && !isColumnCompared) {
                          // Row has differences but this column is not being compared
                          if (diff.status === "left-only" || diff.status === "right-only") {
                            cellStatus = "duplicate";
                          }
                        }
                        
                        // Apply colors based on comparison status
                        const cellClassName = cn(
                          "max-w-xs p-2 text-xs",
                          cellStatus === "same" && "bg-green-50/50 dark:bg-green-950/20",
                          cellStatus === "different" && "bg-red-50/50 dark:bg-red-950/20",
                          cellStatus === "duplicate" && "bg-yellow-50/50 dark:bg-yellow-950/20",
                          isDiffColumn && "font-semibold",
                          // Ensure null rows have minimum height to match other rows
                          isNull && "min-h-[2.5rem]"
                        );
                        
                        return (
                          <TableCell
                            key={column}
                            className={cellClassName}
                          >
                            <div className="flex items-center gap-1 min-h-[1.5rem]">
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
                              {isNull ? (
                                // Render invisible character to maintain row height for null rows
                                <span className="opacity-0 select-none">—</span>
                              ) : (
                                <TableCellComponent value={cellValue} />
                              )}
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
                        const childDiff = comparisonResult?.get(childIndex);
                        const childIsDuplicateRow = duplicateRowIndices.has(childIndex);
                        const childIsNameDuplicateRow = nameDuplicateRowIndices.has(childIndex);
                        const childIsHighlighted = highlightedRow === childIndex;
                        const childIsDifferent =
                          side === "left"
                            ? childDiff?.status === "different" || childDiff?.status === "left-only"
                            : childDiff?.status === "different" || childDiff?.status === "right-only";
                        
                        const childUniqueRowKey = `${String(childUniqueKey)}-${childIndex}`;
                        
                        renderedRows.push(
                          <TableRow
                            key={childUniqueRowKey}
                            ref={(el) => {
                              rowRefs.current[childIndex] = el;
                            }}
                            className={cn(
                              "bg-muted/30",
                              childIsDifferent && "bg-destructive/10 hover:bg-destructive/20",
                              (childIsDuplicateRow || childIsNameDuplicateRow) &&
                                "ring-1 ring-amber-400 bg-amber-50/80",
                              childIsHighlighted && "ring-2 ring-primary"
                            )}
                          >
                            {/* STT cell for child row */}
                            <TableCell className="font-medium p-2 text-xs w-[100px] min-w-[100px] max-w-[100px] sticky left-0 bg-muted/30 z-10 border-r text-center">
                              {(pagination?.offset ?? 0) + childIndex + 1}
                            </TableCell>
                            {columns.map((column) => {
                              // Check if this child row is a null row
                              const childIsNull = isNullRow(childRow, columns.length > 0 ? columns : Object.keys(childRow));
                              
                              const isDiffColumn = childDiff?.diffColumns?.includes(column);
                              const combined = combinedColumns.find(c => c.name === column);
                              const rawValue = combined 
                                ? getColumnValue(childRow, column, combinedColumns)
                                : childRow[column];
                              const cellValue = extractActualValue(rawValue);
                              const isColumnCompared = columnsToCompare.length > 0 && columnsToCompare.includes(column);
                              let cellStatus: "same" | "different" | "duplicate" | "none" = "none";
                              
                              if (childDiff && isColumnCompared) {
                                if (childDiff.status === "same" && !isDiffColumn) {
                                  cellStatus = "same";
                                } else if (isDiffColumn) {
                                  cellStatus = "different";
                                } else if (childDiff.status === "left-only" || childDiff.status === "right-only") {
                                  cellStatus = "duplicate";
                                }
                              } else if (childDiff && !isColumnCompared) {
                                if (childDiff.status === "left-only" || childDiff.status === "right-only") {
                                  cellStatus = "duplicate";
                                }
                              }
                              
                              const cellClassName = cn(
                                "max-w-xs p-2 text-xs pl-8",
                                cellStatus === "same" && "bg-green-50/50 dark:bg-green-950/20",
                                cellStatus === "different" && "bg-red-50/50 dark:bg-red-950/20",
                                cellStatus === "duplicate" && "bg-yellow-50/50 dark:bg-yellow-950/20",
                                isDiffColumn && "font-semibold",
                                // Ensure null rows have minimum height to match other rows
                                childIsNull && "min-h-[2.5rem]"
                              );
                              
                              return (
                                <TableCell
                                  key={column}
                                  className={cellClassName}
                                >
                                  <div className="flex items-center gap-1 min-h-[1.5rem]">
                                    {childIsNull ? (
                                      // Render invisible character to maintain row height for null rows
                                      <span className="opacity-0 select-none">—</span>
                                    ) : (
                                      <TableCellComponent value={cellValue} />
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                        
                        processedIndices.add(childIndex);
                      }
                    });
                  }
                });
                
                return renderedRows;
              })()
            ) : columns.length > 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  {filters.hasActiveFilters
                    ? "Không có dữ liệu khớp với bộ lọc hiện tại"
                    : isLoading
                    ? "Đang tải dữ liệu..."
                    : "Không có dữ liệu"}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      {/* Pagination */}
      {pagination && totalRows !== undefined && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-t border-border">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs text-muted-foreground">
              {filters.hasActiveFilters ? (
                <>
                  Showing {filteredRowCount ?? rows.length} of {totalRows} rows
                  {(filteredRowCount ?? rows.length) !== totalRows && (
                    <span className="text-primary"> (filtered)</span>
                  )}
                  <span className="ml-1">
                    ({columns.length} columns)
                  </span>
                </>
              ) : (
                <>
                  Showing {pagination.offset + 1} -{" "}
                  {Math.min(pagination.offset + (limit ?? 0), totalRows)} of{" "}
                  {totalRows} rows ({columns.length} columns)
                </>
              )}
            </div>
           
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={pagination.handleFirstPage}
              disabled={pagination.page === 0}
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={pagination.handlePrevious}
              disabled={pagination.page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Page</span>
              <Input
                type="number"
                min={1}
                max={pagination.totalPages || 1}
                value={pagination.pageInput}
                onChange={(e) =>
                  pagination.handlePageInputChange(e.target.value)
                }
                onBlur={pagination.handlePageInputSubmit}
                onKeyDown={pagination.handlePageInputKeyDown}
                className="h-8 w-16 text-center text-xs"
              />
              <span className="text-xs text-muted-foreground">
                of {pagination.totalPages || 1}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={pagination.handleNext}
              disabled={hasMore === false || pagination.page >= pagination.totalPages - 1}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={pagination.handleLastPage}
              disabled={hasMore === false || pagination.page >= pagination.totalPages - 1}
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

