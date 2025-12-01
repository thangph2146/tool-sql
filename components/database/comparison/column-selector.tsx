"use client";

import { useState, useMemo } from "react";
import { Check, X, Plus, Settings2, ChevronUp, ChevronDown, Link, ChevronRight } from "lucide-react";
import { useTableData } from "@/lib/hooks/use-database-query";
import type { DatabaseName } from "@/lib/db-config";
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
import { ScrollArea } from "@/components/ui/scroll-area";

export interface CombinedColumn {
  id: string;
  name: string;
  sourceColumns: string[];
  side: "left" | "right";
  // For joining columns from other table
  joinTable?: {
    side: "left" | "right"; // Which table to join from
    relationship: {
      FK_COLUMN: string;
      PK_COLUMN: string;
      FK_TABLE: string;
      PK_TABLE: string;
      FK_SCHEMA: string;
      PK_SCHEMA: string;
    };
    joinColumn: string; // Column name from the joined table
  };
}

interface RelationshipInfo {
  FK_NAME: string;
  FK_SCHEMA: string;
  FK_TABLE: string;
  FK_COLUMN: string;
  PK_SCHEMA: string;
  PK_TABLE: string;
  PK_COLUMN: string;
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
  // For joining columns from other table
  otherSideRelationships?: RelationshipInfo[];
  currentTableRelationships?: RelationshipInfo[]; // Relationships from current table
  otherSideTableInfo?: {
    schemaName: string;
    tableName: string;
    columns: string[];
    rows: Record<string, unknown>[];
  };
  currentTableInfo?: {
    schemaName: string;
    tableName: string;
  };
  databaseName?: string; // Database name for fetching columns from other tables
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
  otherSideRelationships = [],
  currentTableRelationships = [],
  otherSideTableInfo,
  currentTableInfo,
  databaseName,
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCombineOpen, setIsCombineOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [selectedCombineColumns, setSelectedCombineColumns] = useState<Set<string>>(new Set());
  const [combineName, setCombineName] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");
  const [combineSortOrder, setCombineSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");
  const [columnPriorities, setColumnPriorities] = useState<Map<string, number>>(new Map());
  // For joining from other table
  const [selectedJoinTable, setSelectedJoinTable] = useState<string>(""); // Format: "schema.table"
  const [selectedJoinRelationship, setSelectedJoinRelationship] = useState<RelationshipInfo | null>(null);
  const [selectedJoinColumn, setSelectedJoinColumn] = useState<string>("");
  const [joinColumnName, setJoinColumnName] = useState<string>("");
  const [joinSortOrder, setJoinSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");
  // For collapsing columns by table
  const [expandedTableGroups, setExpandedTableGroups] = useState<Set<string>>(new Set(["current", "combined"]));

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

  // Group columns by table
  type ColumnItem = { 
    type: 'regular'; 
    name: string;
    tableKey: string;
  } | { 
    type: 'combined'; 
    combined: typeof sideCombinedColumns[0];
    tableKey: string;
  } | {
    type: 'joined';
    combined: typeof sideCombinedColumns[0];
    tableKey: string;
    tableName: string;
  };
  
  // Group columns by table
  const columnsByTable = useMemo(() => {
    const groups = new Map<string, ColumnItem[]>();
    
    // Current table columns
    const currentTableKey = currentTableInfo ? `${currentTableInfo.schemaName}.${currentTableInfo.tableName}` : 'current';
    const currentTableItems: ColumnItem[] = sideColumns.map(col => ({ 
      type: 'regular' as const, 
      name: col,
      tableKey: currentTableKey,
    }));
    if (currentTableItems.length > 0) {
      groups.set('current', currentTableItems);
    }
    
    // Combined columns (from current table)
    const combinedItems: ColumnItem[] = sideCombinedColumns
      .filter(c => !c.joinTable)
      .map(combined => ({ 
        type: 'combined' as const, 
        combined,
        tableKey: currentTableKey,
      }));
    if (combinedItems.length > 0) {
      const existing = groups.get('current') || [];
      groups.set('current', [...existing, ...combinedItems]);
    }
    
    // Joined columns (from other tables)
    const joinedItems = sideCombinedColumns
      .filter(c => c.joinTable)
      .map(combined => {
        const rel = combined.joinTable!.relationship;
        // Determine which table the column is from
        const currentTableIsFK = rel.FK_SCHEMA === currentTableInfo?.schemaName && 
                                  rel.FK_TABLE === currentTableInfo?.tableName;
        const joinTableKey = currentTableIsFK 
          ? `${rel.PK_SCHEMA}.${rel.PK_TABLE}`
          : `${rel.FK_SCHEMA}.${rel.FK_TABLE}`;
        const joinTableName = currentTableIsFK 
          ? `${rel.PK_SCHEMA}.${rel.PK_TABLE}`
          : `${rel.FK_SCHEMA}.${rel.FK_TABLE}`;
        return {
          type: 'joined' as const,
          combined,
          tableKey: joinTableKey,
          tableName: joinTableName,
        };
      });
    
    // Group joined items by table
    joinedItems.forEach(item => {
      const key = item.tableKey;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });
    
    return groups;
  }, [sideColumns, sideCombinedColumns, currentTableInfo]);

  // Sort columns within each group
  const sortedColumnsByTable = useMemo(() => {
    const sorted = new Map<string, ColumnItem[]>();
    
    columnsByTable.forEach((items, tableKey) => {
      const sortedItems = [...items].sort((a, b) => {
        const nameA = a.type === 'regular' ? a.name : a.combined.name;
        const nameB = b.type === 'regular' ? b.name : b.combined.name;
        
        const priorityA = columnPriorities.get(nameA) ?? Infinity;
        const priorityB = columnPriorities.get(nameB) ?? Infinity;
        
        if (priorityA !== Infinity || priorityB !== Infinity) {
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
        }
        
        if (sortOrder === "alphabetical") {
          return nameA.localeCompare(nameB);
        } else if (sortOrder === "newest") {
          const indexA = a.type === 'regular' 
            ? tableColumns.indexOf(nameA)
            : (a.combined.sourceColumns.length > 0 ? tableColumns.indexOf(a.combined.sourceColumns[0]) : -1);
          const indexB = b.type === 'regular'
            ? tableColumns.indexOf(nameB)
            : (b.combined.sourceColumns.length > 0 ? tableColumns.indexOf(b.combined.sourceColumns[0]) : -1);
          return indexB - indexA;
        } else {
          const indexA = a.type === 'regular'
            ? tableColumns.indexOf(nameA)
            : (a.combined.sourceColumns.length > 0 ? tableColumns.indexOf(a.combined.sourceColumns[0]) : -1);
          const indexB = b.type === 'regular'
            ? tableColumns.indexOf(nameB)
            : (b.combined.sourceColumns.length > 0 ? tableColumns.indexOf(b.combined.sourceColumns[0]) : -1);
          return indexA - indexB;
        }
      });
      
      sorted.set(tableKey, sortedItems);
    });
    
    return sorted;
  }, [columnsByTable, columnPriorities, sortOrder, tableColumns]);

  const toggleTableGroup = (tableKey: string) => {
    const newExpanded = new Set(expandedTableGroups);
    if (newExpanded.has(tableKey)) {
      newExpanded.delete(tableKey);
    } else {
      newExpanded.add(tableKey);
    }
    setExpandedTableGroups(newExpanded);
  };

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

  // Handler for adding joined column from other table
  const handleAddJoinColumn = () => {
    if (!selectedJoinTable || !selectedJoinRelationship || !selectedJoinColumn || !joinColumnName) {
      return;
    }

    const newCombined: CombinedColumn = {
      id: `joined_${side}_${Date.now()}`,
      name: joinColumnName,
      sourceColumns: [], // Empty for joined columns
      side,
      joinTable: {
        side: side === "left" ? "right" : "left",
        relationship: selectedJoinRelationship,
        joinColumn: selectedJoinColumn,
      },
    };

    onCombinedColumnsChange([...combinedColumns, newCombined]);
    
    // Auto-select the new joined column
    const newSelected = new Set(selectedColumns);
    newSelected.add(joinColumnName);
    onSelectionChange(newSelected);

    // Reset form
    setSelectedJoinTable("");
    setSelectedJoinRelationship(null);
    setSelectedJoinColumn("");
    setJoinColumnName("");
    setIsJoinOpen(false);
  };

  // Get all tables that have relationships with current table
  const availableJoinTables = useMemo(() => {
    if (!currentTableInfo) {
      return [];
    }
    
    // Combine relationships from both current table and other side
    const allRelationships = [...currentTableRelationships, ...otherSideRelationships];
    
    if (allRelationships.length === 0) {
      return [];
    }
    
    // Remove duplicates based on FK_NAME
    const uniqueRelationships = new Map<string, RelationshipInfo>();
    allRelationships.forEach(rel => {
      if (!uniqueRelationships.has(rel.FK_NAME)) {
        uniqueRelationships.set(rel.FK_NAME, rel);
      }
    });
    const deduplicated = Array.from(uniqueRelationships.values());
    
    // Get all unique tables that are connected to current table
    const tableMap = new Map<string, { schema: string; table: string; relationships: RelationshipInfo[] }>();
    
    deduplicated.forEach(rel => {
      const currentTableIsFK = rel.FK_SCHEMA === currentTableInfo.schemaName && 
                                rel.FK_TABLE === currentTableInfo.tableName;
      const currentTableIsPK = rel.PK_SCHEMA === currentTableInfo.schemaName &&
                               rel.PK_TABLE === currentTableInfo.tableName;
      
      if (currentTableIsFK) {
        // Current table is FK, so PK table is the target
        const key = `${rel.PK_SCHEMA}.${rel.PK_TABLE}`;
        if (!tableMap.has(key)) {
          tableMap.set(key, { schema: rel.PK_SCHEMA, table: rel.PK_TABLE, relationships: [] });
        }
        tableMap.get(key)!.relationships.push(rel);
      } else if (currentTableIsPK) {
        // Current table is PK, so FK table is the target
        const key = `${rel.FK_SCHEMA}.${rel.FK_TABLE}`;
        if (!tableMap.has(key)) {
          tableMap.set(key, { schema: rel.FK_SCHEMA, table: rel.FK_TABLE, relationships: [] });
        }
        tableMap.get(key)!.relationships.push(rel);
      }
    });
    
    // Convert to array and sort
    return Array.from(tableMap.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => {
        if (joinSortOrder === "alphabetical") {
          return a.key.localeCompare(b.key);
        } else if (joinSortOrder === "newest") {
          // For newest, sort by number of relationships (more relationships = newer)
          return b.relationships.length - a.relationships.length;
        } else { // oldest
          return a.relationships.length - b.relationships.length;
        }
      });
  }, [currentTableRelationships, otherSideRelationships, currentTableInfo, joinSortOrder]);

  // Get relationships for selected table
  const relationshipsForSelectedTable = useMemo(() => {
    if (!selectedJoinTable) {
      return [];
    }
    const tableInfo = availableJoinTables.find(t => t.key === selectedJoinTable);
    return tableInfo?.relationships || [];
  }, [selectedJoinTable, availableJoinTables]);

  // Parse selected table to get schema and table name
  const selectedTableInfo = useMemo(() => {
    if (!selectedJoinTable) {
      return null;
    }
    const parts = selectedJoinTable.split('.');
    if (parts.length === 2) {
      return { schema: parts[0], table: parts[1] };
    }
    return null;
  }, [selectedJoinTable]);

  // Fetch columns for selected table from API if it's not the other side table
  const { data: selectedTableData, isLoading: isLoadingSelectedTableColumns } = useTableData(
    databaseName as DatabaseName | undefined,
    selectedTableInfo?.schema,
    selectedTableInfo?.table,
    1, // limit = 1, we only need columns
    0, // offset = 0
    !!selectedTableInfo && !!databaseName && 
      !(selectedTableInfo.schema === otherSideTableInfo?.schemaName && 
        selectedTableInfo.table === otherSideTableInfo?.tableName), // Don't fetch if it's other side table
    false // includeReferences = false
  );

  // Get columns for selected table
  const columnsForSelectedTable = useMemo(() => {
    if (!selectedJoinTable) {
      return [];
    }
    
    const [schema, table] = selectedJoinTable.split('.');
    
    // If selected table is the other side table, use its columns
    if (otherSideTableInfo && schema === otherSideTableInfo.schemaName && table === otherSideTableInfo.tableName) {
      return otherSideTableInfo.columns;
    }
    
    // Otherwise, use columns from API fetch
    if (selectedTableData?.data?.columns) {
      return selectedTableData.data.columns.map(c => String(c));
    }
    
    return [];
  }, [selectedJoinTable, otherSideTableInfo, selectedTableData]);

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
          {/* Column list grouped by table */}
          <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
            {Array.from(sortedColumnsByTable.entries()).map(([tableKey, items]) => {
              const isExpanded = expandedTableGroups.has(tableKey);
              const tableName = tableKey === 'current' 
                ? (currentTableInfo ? `${currentTableInfo.schemaName}.${currentTableInfo.tableName}` : 'Bảng hiện tại')
                : (items.find(item => item.type === 'joined') as Extract<ColumnItem, { type: 'joined' }>)?.tableName || tableKey;
              
              return (
                <div key={tableKey} className="space-y-1">
                  {/* Table header with collapse/expand */}
                  <div
                    className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
                    onClick={() => toggleTableGroup(tableKey)}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTableGroup(tableKey);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>
                    <span className="text-sm font-semibold flex-1">{tableName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {items.length}
                    </Badge>
                  </div>
                  
                  {/* Columns in this table */}
                  {isExpanded && (
                    <div 
                      className="ml-4 grid gap-2"
                      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min-content, 1fr))' }}
                    >
                      {items.map((item) => {
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
                        } else if (item.type === 'combined') {
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
                        } else {
                          // Joined column
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
                                    <span className="text-xs text-muted-foreground ml-1">(join)</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.tableName}.{combined.joinTable?.joinColumn}
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
                  )}
                </div>
              );
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

      {/* Join Column from Other Table Popover */}
      {otherSideTableInfo && (
        <Popover open={isJoinOpen} onOpenChange={setIsJoinOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">Join từ bảng khác</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[450px] p-4" align="start">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Join cột từ bảng khác</h3>
              <ScrollArea className="w-full max-h-[50dvh] overflow-y-auto">
              
              {availableJoinTables.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                  <div className="font-semibold mb-1">Không tìm thấy bảng có relationships</div>
                  <div>Với {currentTableInfo ? `${currentTableInfo.schemaName}.${currentTableInfo.tableName}` : 'table hiện tại'}.</div>
                </div>
              ) : (
                <>

                  {/* Sort options */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Sắp xếp:</Label>
                    <Select value={joinSortOrder} onValueChange={(value: "alphabetical" | "newest" | "oldest") => setJoinSortOrder(value)}>
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

                  {/* Step 1: Select Table */}
                  <div className="space-y-2">
                    <Label className="text-xs">Bước 1: Chọn bảng (1 bảng)</Label>
                    <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
                      {availableJoinTables.map((tableInfo) => {
                        const isSelected = selectedJoinTable === tableInfo.key;
                        return (
                          <div
                            key={tableInfo.key}
                            className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
                            onClick={() => {
                              setSelectedJoinTable(isSelected ? "" : tableInfo.key);
                              setSelectedJoinRelationship(null);
                              setSelectedJoinColumn("");
                            }}
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
                            <div className="flex-1">
                              <div className="text-sm">{tableInfo.table}</div>
                              <div className="text-xs text-muted-foreground">{tableInfo.schema}</div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {tableInfo.relationships.length}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Select Relationship (only if table selected) */}
                  {selectedJoinTable && relationshipsForSelectedTable.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Bước 2: Chọn relationship</Label>
                      <Select
                        value={selectedJoinRelationship ? `${selectedJoinRelationship.FK_NAME}` : ""}
                        onValueChange={(value) => {
                          const rel = relationshipsForSelectedTable.find(r => r.FK_NAME === value);
                          setSelectedJoinRelationship(rel || null);
                          setSelectedJoinColumn(""); // Reset column selection when relationship changes
                        }}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Chọn relationship..." />
                        </SelectTrigger>
                        <SelectContent>
                          {relationshipsForSelectedTable.map((rel) => (
                            <SelectItem key={rel.FK_NAME} value={rel.FK_NAME}>
                              {rel.FK_TABLE}.{rel.FK_COLUMN} → {rel.PK_TABLE}.{rel.PK_COLUMN}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedJoinRelationship && (
                        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                          <div>FK: {selectedJoinRelationship.FK_TABLE}.{selectedJoinRelationship.FK_COLUMN}</div>
                          <div>PK: {selectedJoinRelationship.PK_TABLE}.{selectedJoinRelationship.PK_COLUMN}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Select Column from Selected Table */}
                  {selectedJoinTable && selectedJoinRelationship && (
                    <div className="space-y-2">
                      <Label className="text-xs">Bước 3: Chọn cột từ bảng {selectedJoinTable}</Label>
                      {columnsForSelectedTable.length > 0 ? (
                        <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
                          {columnsForSelectedTable.map((col) => {
                            const isSelected = selectedJoinColumn === col;
                            return (
                              <div
                                key={col}
                                className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
                                onClick={() => setSelectedJoinColumn(isSelected ? "" : col)}
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
                                <span className="text-sm flex-1">{col}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                          Không có thông tin columns cho bảng này. Vui lòng chọn bảng từ bên kia để có thông tin columns.
                        </div>
                      )}
                    </div>
                  )}
                  {/* Step 4: Column Name */}
                  <div className="space-y-2">
                    <Label className="text-xs">Bước 4: Tên cột mới</Label>
                    <Input
                      value={joinColumnName}
                      onChange={(e) => setJoinColumnName(e.target.value)}
                      placeholder="Nhập tên cột mới"
                      className="w-full h-8 text-xs"
                    />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={handleAddJoinColumn}
                      disabled={
                        !selectedJoinTable ||
                        !selectedJoinRelationship ||
                        !selectedJoinColumn ||
                        !joinColumnName
                      }
                    >
                      Thêm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setIsJoinOpen(false);
                        setSelectedJoinTable("");
                        setSelectedJoinRelationship(null);
                        setSelectedJoinColumn("");
                        setJoinColumnName("");
                      }}
                    >
                      Hủy
                    </Button>
                  </div>
                </>
              )}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

