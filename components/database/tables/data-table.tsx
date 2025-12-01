"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { Link2, ArrowUpDown, X } from "lucide-react";
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
  const sortedRows = useMemo(() => {
    if (sortColumns.length === 0) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      // Sort by each column in order
      for (const { column, order } of sortColumns) {
        const aValue = a[column];
        const bValue = b[column];

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
  }, [rows, sortColumns]);

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
          sortedRows.map((row, rowIndex) => {
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

