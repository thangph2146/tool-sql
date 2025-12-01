"use client";

import { useState, useMemo } from "react";
import { Check, X, Plus, Settings2 } from "lucide-react";
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
}

export function ColumnSelector({
  availableColumns,
  selectedColumns,
  onSelectionChange,
  combinedColumns,
  onCombinedColumnsChange,
  side,
  tableColumns,
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCombineDialog, setShowCombineDialog] = useState(false);
  const [combineColumn1, setCombineColumn1] = useState<string>("");
  const [combineColumn2, setCombineColumn2] = useState<string>("");
  const [combineName, setCombineName] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");

  // Get columns available for this side with sorting
  const sideColumns = useMemo(() => {
    const filtered = tableColumns.filter((col) => availableColumns.includes(col));
    
    // Sort based on selected order
    if (sortOrder === "alphabetical") {
      return [...filtered].sort((a, b) => a.localeCompare(b));
    } else if (sortOrder === "newest") {
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
  }, [tableColumns, availableColumns, sortOrder]);

  // Get combined columns for this side
  const sideCombinedColumns = useMemo(() => {
    return combinedColumns.filter((col) => col.side === side);
  }, [combinedColumns, side]);

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

  const handleAddCombinedColumn = () => {
    if (!combineColumn1 || !combineColumn2 || !combineName) {
      return;
    }
    if (combineColumn1 === combineColumn2) {
      return;
    }
    if (!sideColumns.includes(combineColumn1) || !sideColumns.includes(combineColumn2)) {
      return;
    }

    const newCombined: CombinedColumn = {
      id: `combined_${side}_${Date.now()}`,
      name: combineName,
      sourceColumns: [combineColumn1, combineColumn2],
      side,
    };

    onCombinedColumnsChange([...combinedColumns, newCombined]);
    
    // Auto-select the new combined column
    const newSelected = new Set(selectedColumns);
    newSelected.add(combineName);
    onSelectionChange(newSelected);

    // Reset form
    setCombineColumn1("");
    setCombineColumn2("");
    setCombineName("");
    setShowCombineDialog(false);
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


  return (
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
            <Select value={sortOrder} onValueChange={(value: "alphabetical" | "newest" | "oldest") => setSortOrder(value)}>
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

          <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
            {sideColumns.map((column) => {
              const isSelected = selectedColumns.has(column);
              return (
                <div
                  key={column}
                  className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
                  onClick={() => handleToggleColumn(column)}
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

            {sideCombinedColumns.length > 0 && (
              <>
                <div className="border-t my-2" />
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Cột kết hợp:
                </div>
                {sideCombinedColumns.map((combined) => (
                  <div
                    key={combined.id}
                    className="flex items-center gap-2 p-1 hover:bg-muted rounded"
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
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
                      <div className="text-sm font-medium">{combined.name}</div>
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
                ))}
              </>
            )}
          </div>

          <div className="border-t pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowCombineDialog(!showCombineDialog)}
            >
              <Plus className="h-4 w-4" />
              Kết hợp 2 cột
            </Button>

            {showCombineDialog && (
              <div className="mt-3 space-y-3 p-3 border rounded-md bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-xs">Cột 1</Label>
                  <Select value={combineColumn1} onValueChange={setCombineColumn1}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Chọn cột 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {sideColumns
                        .filter((col) => col !== combineColumn2)
                        .map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Cột 2</Label>
                  <Select value={combineColumn2} onValueChange={setCombineColumn2}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Chọn cột 2" />
                    </SelectTrigger>
                    <SelectContent>
                      {sideColumns
                        .filter((col) => col !== combineColumn1)
                        .map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
                      !combineColumn1 ||
                      !combineColumn2 ||
                      !combineName ||
                      combineColumn1 === combineColumn2
                    }
                  >
                    Thêm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setShowCombineDialog(false);
                      setCombineColumn1("");
                      setCombineColumn2("");
                      setCombineName("");
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

