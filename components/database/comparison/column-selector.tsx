"use client";

import { useState, useMemo } from "react";
import { Check, X, Plus, Settings2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CombinedColumn {
  id: string;
  name: string;
  sourceColumns: string[];
  side: "left" | "right";
}

interface ColumnSelectorProps {
  availableColumns: string[];
  selectedColumns: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  combinedColumns: CombinedColumn[];
  onCombinedColumnsChange: (combined: CombinedColumn[]) => void;
  side: "left" | "right";
  tableColumns: string[];
  onColumnPrioritiesChange?: (priorities: Map<string, number>) => void;
  onSortOrderChange?: (sortOrder: "alphabetical" | "newest" | "oldest") => void;
}

export function ColumnSelector({
  availableColumns,
  selectedColumns,
  onSelectionChange,
  combinedColumns,
  onCombinedColumnsChange,
  side,
  tableColumns,
  onColumnPrioritiesChange,
  onSortOrderChange,
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCombineOpen, setIsCombineOpen] = useState(false);
  const [selectedCombineColumns, setSelectedCombineColumns] = useState<Set<string>>(new Set());
  const [combineName, setCombineName] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");
  const [combineSortOrder, setCombineSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");
  const [columnPriorities, setColumnPriorities] = useState<Map<string, number>>(new Map());

  // Get columns available for this side with sorting (for column selector)
  // Priority takes precedence, then sortOrder
  const sideColumns = useMemo(() => {
    const filtered = tableColumns.filter((col) => availableColumns.includes(col));
    
    // Sort: first by priority (lower number = higher priority), then by sortOrder
    return [...filtered].sort((a, b) => {
      const priorityA = columnPriorities.get(a) ?? Infinity;
      const priorityB = columnPriorities.get(b) ?? Infinity;
      
      // If both have priority, sort by priority first
      if (priorityA !== Infinity || priorityB !== Infinity) {
        if (priorityA !== priorityB) {
          return priorityA - priorityB; // Lower priority number = higher priority
        }
      }
      
      // If same priority or no priority, sort by sortOrder
      if (sortOrder === "alphabetical") {
        return a.localeCompare(b);
      } else if (sortOrder === "newest") {
        const indexA = tableColumns.indexOf(a);
        const indexB = tableColumns.indexOf(b);
        return indexB - indexA; // Reverse order (newest first)
      } else { // oldest
        const indexA = tableColumns.indexOf(a);
        const indexB = tableColumns.indexOf(b);
        return indexA - indexB; // Normal order (oldest first)
      }
    });
  }, [tableColumns, availableColumns, sortOrder, columnPriorities]);

  // Get columns available for combine dialog with separate sorting
  const combineColumns = useMemo(() => {
    const filtered = tableColumns.filter((col) => availableColumns.includes(col));
    
    // Sort based on combine sort order
    if (combineSortOrder === "alphabetical") {
      return [...filtered].sort((a, b) => a.localeCompare(b));
    } else if (combineSortOrder === "newest") {
      // Newest = columns that appear later in the original tableColumns array
      return [...filtered].sort((a, b) => {
        const indexA = tableColumns.indexOf(a);
        const indexB = tableColumns.indexOf(b);
        return indexB - indexA; // Reverse order (newest first)
      });
    } else { // oldest
      // Oldest = columns that appear earlier in the original tableColumns array
      return [...filtered].sort((a, b) => {
        const indexA = tableColumns.indexOf(a);
        const indexB = tableColumns.indexOf(b);
        return indexA - indexB; // Normal order (oldest first)
      });
    }
  }, [tableColumns, availableColumns, combineSortOrder]);

  // Get combined columns for this side, sorted by priority
  const sideCombinedColumns = useMemo(() => {
    return combinedColumns.filter((col) => col.side === side);
  }, [combinedColumns, side]);

  // Merge and sort all columns (regular + combined) by priority, then by sortOrder
  type ColumnItem = { type: 'regular'; name: string } | { type: 'combined'; combined: typeof sideCombinedColumns[0] };
  const allColumnsSorted = useMemo(() => {
    const regularItems: ColumnItem[] = sideColumns.map(col => ({ type: 'regular' as const, name: col }));
    const combinedItems: ColumnItem[] = sideCombinedColumns.map(combined => ({ type: 'combined' as const, combined }));
    
    const allItems = [...regularItems, ...combinedItems];
    
    // Sort: first by priority (lower number = higher priority), then by sortOrder
    return allItems.sort((a, b) => {
      const nameA = a.type === 'regular' ? a.name : a.combined.name;
      const nameB = b.type === 'regular' ? b.name : b.combined.name;
      
      const priorityA = columnPriorities.get(nameA) ?? Infinity;
      const priorityB = columnPriorities.get(nameB) ?? Infinity;
      
      // If both have priority, sort by priority first
      if (priorityA !== Infinity || priorityB !== Infinity) {
        if (priorityA !== priorityB) {
          return priorityA - priorityB; // Lower priority number = higher priority
        }
      }
      
      // If same priority or no priority, sort by sortOrder
      if (sortOrder === "alphabetical") {
        return nameA.localeCompare(nameB);
      } else if (sortOrder === "newest") {
        // For regular columns, use their index in tableColumns
        // For combined columns, use the index of their first source column
        const indexA = a.type === 'regular' 
          ? tableColumns.indexOf(nameA)
          : (a.combined.sourceColumns.length > 0 ? tableColumns.indexOf(a.combined.sourceColumns[0]) : -1);
        const indexB = b.type === 'regular'
          ? tableColumns.indexOf(nameB)
          : (b.combined.sourceColumns.length > 0 ? tableColumns.indexOf(b.combined.sourceColumns[0]) : -1);
        return indexB - indexA; // Reverse order (newest first)
      } else { // oldest
        const indexA = a.type === 'regular'
          ? tableColumns.indexOf(nameA)
          : (a.combined.sourceColumns.length > 0 ? tableColumns.indexOf(a.combined.sourceColumns[0]) : -1);
        const indexB = b.type === 'regular'
          ? tableColumns.indexOf(nameB)
          : (b.combined.sourceColumns.length > 0 ? tableColumns.indexOf(b.combined.sourceColumns[0]) : -1);
        return indexA - indexB; // Normal order (oldest first)
      }
    });
  }, [sideColumns, sideCombinedColumns, columnPriorities, sortOrder, tableColumns]);

  const handleToggleColumn = (column: string) => {
    // Only toggle columns that belong to this side's table
    if (!tableColumns.includes(column) && !sideCombinedColumns.some(c => c.name === column)) {
      return;
    }
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(column)) {
      newSelected.delete(column);
    } else {
      newSelected.add(column);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    // Only select columns for this side
    const sideColsSet = new Set(tableColumns);
    const allColumnsForSide = new Set([
      ...Array.from(sideColsSet).filter(col => availableColumns.includes(col)),
      ...sideCombinedColumns.map(c => c.name)
    ]);
    
    // Merge with existing selections from other side
    const newSelected = new Set(selectedColumns);
    allColumnsForSide.forEach(col => newSelected.add(col));
    onSelectionChange(newSelected);
  };

  const handleDeselectAll = () => {
    // Only deselect columns for this side, keep columns from other side
    const sideColsSet = new Set(tableColumns);
    const newSelected = new Set(selectedColumns);
    
    // Remove only columns that belong to this side
    sideColsSet.forEach(col => {
      if (availableColumns.includes(col)) {
        newSelected.delete(col);
      }
    });
    
    // Also remove combined columns for this side
    sideCombinedColumns.forEach(combined => {
      newSelected.delete(combined.name);
    });
    
    onSelectionChange(newSelected);
  };

  const handleToggleCombineColumn = (column: string) => {
    const newSelected = new Set(selectedCombineColumns);
    if (newSelected.has(column)) {
      newSelected.delete(column);
    } else {
      newSelected.add(column);
    }
    setSelectedCombineColumns(newSelected);
  };

  const handleAddCombinedColumn = () => {
    if (selectedCombineColumns.size === 0 || !combineName) {
      return;
    }
    
    // Validate all selected columns exist in tableColumns
    const selectedArray = Array.from(selectedCombineColumns);
    const allValid = selectedArray.every(col => tableColumns.includes(col));
    if (!allValid) {
      return;
    }

    const newCombined: CombinedColumn = {
      id: `combined_${side}_${Date.now()}`,
      name: combineName,
      sourceColumns: selectedArray,
      side,
    };

    onCombinedColumnsChange([...combinedColumns, newCombined]);
    
    // Auto-select the new combined column
    const newSelected = new Set(selectedColumns);
    newSelected.add(combineName);
    onSelectionChange(newSelected);

    // Reset form
    setSelectedCombineColumns(new Set());
    setCombineName("");
    setIsCombineOpen(false);
  };

  const handleRemoveCombinedColumn = (id: string) => {
    const updated = combinedColumns.filter((col) => col.id !== id);
    onCombinedColumnsChange(updated);
    
    // Remove from selected if it was selected
    const removedCol = combinedColumns.find((col) => col.id === id);
    if (removedCol) {
      const newSelected = new Set(selectedColumns);
      newSelected.delete(removedCol.name);
      onSelectionChange(newSelected);
    }
  };

  const handlePriorityChange = (column: string, priority: number | null) => {
    const newPriorities = new Map(columnPriorities);
    if (priority === null || priority <= 0 || isNaN(priority)) {
      newPriorities.delete(column);
    } else {
      newPriorities.set(column, priority);
    }
    setColumnPriorities(newPriorities);
    onColumnPrioritiesChange?.(newPriorities);
  };

  const handlePriorityIncrease = (column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPriority = columnPriorities.get(column) ?? 0;
    handlePriorityChange(column, currentPriority + 1);
  };

  const handlePriorityDecrease = (column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPriority = columnPriorities.get(column) ?? 0;
    if (currentPriority > 1) {
      handlePriorityChange(column, currentPriority - 1);
    } else {
      handlePriorityChange(column, null);
    }
  };


  return (
    <div className="flex gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Columns</span>
            <Badge variant="secondary" className="ml-1">
              {selectedColumns.size}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Chọn cột</h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-7 text-xs"
              >
                Tất cả
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
                className="h-7 text-xs"
              >
                Bỏ chọn
              </Button>
            </div>
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs text-muted-foreground">Sắp xếp:</Label>
            <Select value={sortOrder} onValueChange={(value: "alphabetical" | "newest" | "oldest") => {
              setSortOrder(value);
              onSortOrderChange?.(value);
            }}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alphabetical">Theo chữ cái</SelectItem>
                <SelectItem value="newest">Mới nhất</SelectItem>
                <SelectItem value="oldest">Cũ nhất</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Column list */}
          <div 
            className="max-h-60 overflow-y-auto border rounded-md p-2 grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min-content, 1fr))' }}
          >
            {allColumnsSorted.map((item) => {
              if (item.type === 'regular') {
                const column = item.name;
                const isSelected = selectedColumns.has(column);
                const priority = columnPriorities.get(column);
                return (
                  <div
                    key={column}
                    className="flex flex-col gap-1 p-1 hover:bg-muted rounded"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border cursor-pointer",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input"
                        )}
                        onClick={() => handleToggleColumn(column)}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm flex-1 cursor-pointer" onClick={() => handleToggleColumn(column)}>{column}</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        min="1"
                        value={priority ?? ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value, 10);
                          handlePriorityChange(column, value);
                        }}
                        placeholder="P"
                        className="h-6 w-full text-xs p-1 text-center"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-3 w-4 p-0"
                          onClick={(e) => handlePriorityIncrease(column, e)}
                        >
                          <ChevronUp className="h-2 w-2" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-3 w-4 p-0"
                          onClick={(e) => handlePriorityDecrease(column, e)}
                        >
                          <ChevronDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const combined = item.combined;
                const priority = columnPriorities.get(combined.name);
                return (
                  <div
                    key={combined.id}
                    className="flex flex-col gap-1 p-1 hover:bg-muted rounded"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border cursor-pointer",
                          selectedColumns.has(combined.name)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input"
                        )}
                        onClick={() => handleToggleColumn(combined.name)}
                      >
                        {selectedColumns.has(combined.name) && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium cursor-pointer" onClick={() => handleToggleColumn(combined.name)}>
                          {combined.name}
                          <span className="text-xs text-muted-foreground ml-1">(kết hợp)</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {combined.sourceColumns.join(" + ")}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveCombinedColumn(combined.id)}
                        className="h-6 w-6"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        min="1"
                        value={priority ?? ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value, 10);
                          handlePriorityChange(combined.name, value);
                        }}
                        placeholder="P"
                        className="h-6 w-full text-xs p-1 text-center"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-3 w-4 p-0"
                          onClick={(e) => handlePriorityIncrease(combined.name, e)}
                        >
                          <ChevronUp className="h-2 w-2" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-3 w-4 p-0"
                          onClick={(e) => handlePriorityDecrease(combined.name, e)}
                        >
                          <ChevronDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
      </PopoverContent>
      </Popover>

      <Popover open={isCombineOpen} onOpenChange={setIsCombineOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Kết hợp cột</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Kết hợp cột</h3>
            
            {/* Sort options for combine dialog */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Sắp xếp:</Label>
              <Select value={combineSortOrder} onValueChange={(value: "alphabetical" | "newest" | "oldest") => setCombineSortOrder(value)}>
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">Theo chữ cái</SelectItem>
                  <SelectItem value="newest">Mới nhất</SelectItem>
                  <SelectItem value="oldest">Cũ nhất</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Chọn cột để kết hợp (tối thiểu 1 cột)</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
                {combineColumns.map((column) => {
                  const isSelected = selectedCombineColumns.has(column);
                  return (
                    <div
                      key={column}
                      className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
                      onClick={() => handleToggleCombineColumn(column)}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm flex-1">{column}</span>
                    </div>
                  );
                })}
              </div>
              {selectedCombineColumns.size > 0 && (
                <div className="text-xs text-muted-foreground">
                  Đã chọn: {selectedCombineColumns.size} cột
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Tên cột mới</Label>
              <Input
                value={combineName}
                onChange={(e) => setCombineName(e.target.value)}
                placeholder="Nhập tên cột mới"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={handleAddCombinedColumn}
                disabled={
                  selectedCombineColumns.size === 0 ||
                  !combineName
                }
              >
                Thêm
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setIsCombineOpen(false);
                  setSelectedCombineColumns(new Set());
                  setCombineName("");
                }}
              >
                Hủy
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

