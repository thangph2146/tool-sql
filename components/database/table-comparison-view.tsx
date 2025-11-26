"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Loader2,
  Database,
  GitCompare,
  Settings2,
} from "lucide-react";
import type { DatabaseName } from "@/lib/db-config";
import { useTableData } from "@/lib/hooks/use-database-query";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

interface TableComparisonViewProps {
  leftTable: {
    databaseName: DatabaseName;
    schemaName: string;
    tableName: string;
  };
  rightTable: {
    databaseName: DatabaseName;
    schemaName: string;
    tableName: string;
  };
  onClose?: () => void;
  open?: boolean;
  asDialog?: boolean;
}

const LIMIT_OPTIONS = [10, 25, 50, 100, 200, 500, 1000];

// Helper function to detect image type from Buffer
function detectImageType(bufferData: number[]): string | null {
  if (bufferData.length < 4) return null;
  
  // PNG signature: 89 50 4E 47
  if (bufferData[0] === 0x89 && bufferData[1] === 0x50 && 
      bufferData[2] === 0x4E && bufferData[3] === 0x47) {
    return "image/png";
  }
  // JPEG signature: FF D8 FF
  if (bufferData[0] === 0xFF && bufferData[1] === 0xD8 && bufferData[2] === 0xFF) {
    return "image/jpeg";
  }
  // GIF signature: 47 49 46 38
  if (bufferData[0] === 0x47 && bufferData[1] === 0x49 && 
      bufferData[2] === 0x46 && bufferData[3] === 0x38) {
    return "image/gif";
  }
  
  return null;
}

// Helper function to convert Buffer to data URL
function bufferToDataUrl(value: unknown): string | null {
  let bufferData: number[] | null = null;
  
  // Check if it's a Buffer object (from database)
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "data" in value &&
    value.type === "Buffer" &&
    Array.isArray(value.data)
  ) {
    bufferData = value.data as number[];
  } else if (value instanceof Buffer) {
    bufferData = Array.from(value);
  }
  
  if (!bufferData || bufferData.length === 0) {
    return null;
  }
  
  const imageType = detectImageType(bufferData);
  if (!imageType) {
    return null;
  }
  
  // Convert array of numbers to base64 (safe for large arrays)
  const binaryString = bufferData.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  const base64 = btoa(binaryString);
  return `data:${imageType};base64,${base64}`;
}

// Helper function to format cell value for display
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Check if it's a Buffer object (from database)
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "data" in value &&
    value.type === "Buffer" &&
    Array.isArray(value.data)
  ) {
    const bufferData = value.data as number[];
    const size = bufferData.length;
    const imageType = detectImageType(bufferData);
    
    if (imageType) {
      return `[Image ${imageType.split('/')[1].toUpperCase()} - ${size} bytes]`;
    }
    
    return `[Binary Data - ${size} bytes]`;
  }

  // Check if it's a regular Buffer instance
  if (value instanceof Buffer || (typeof value === "object" && value !== null && "length" in value)) {
    try {
      const buffer = value as { length: number };
      return `[Binary Data - ${buffer.length} bytes]`;
    } catch {
      // Fall through
    }
  }

  // For other values, convert to string
  try {
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  } catch {
    return "[Unable to display]";
  }
}

// Component to render image cell
function ImageCell({ value }: { value: unknown }) {
  const dataUrl = bufferToDataUrl(value);
  const displayText = formatCellValue(value);
  
  if (dataUrl) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="Table image"
          className="h-12 w-12 object-contain rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            // Open image in new window/tab
            const newWindow = window.open();
            if (newWindow) {
              newWindow.document.write(`
                <html>
                  <head><title>Image Viewer</title></head>
                  <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a1a;">
                    <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                  </body>
                </html>
              `);
            }
          }}
          title="Click to view full size"
        />
        <span className="text-xs text-muted-foreground truncate">{displayText}</span>
      </div>
    );
  }
  
  return (
    <div className="truncate" title={displayText}>
      {value !== null && value !== undefined ? (
        displayText
      ) : (
        <span className="text-muted-foreground italic">NULL</span>
      )}
    </div>
  );
}

export function TableComparisonView({
  leftTable,
  rightTable,
  onClose,
  open = true,
  asDialog = false,
}: TableComparisonViewProps) {
  const [limit, setLimit] = useState(100);
  const [page, setPage] = useState(0);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const offset = page * limit;

  // Fetch data for both tables
  const leftData = useTableData(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    limit,
    offset,
    true
  );

  const rightData = useTableData(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    limit,
    offset,
    true
  );

  const leftTableData = leftData.data?.data;
  const rightTableData = rightData.data?.data;

  // Get all unique columns from both tables
  const allColumns = useMemo(() => {
    const leftCols = (leftTableData?.columns || []).map(c => String(c).trim());
    const rightCols = (rightTableData?.columns || []).map(c => String(c).trim());
    const uniqueCols = new Set([...leftCols, ...rightCols]);
    return Array.from(uniqueCols).sort();
  }, [leftTableData?.columns, rightTableData?.columns]);

  // Categorize columns by table
  const columnCategories = useMemo(() => {
    if (!leftTableData?.columns || !rightTableData?.columns) {
      return { leftOnly: [], rightOnly: [], both: [] };
    }
    
    const leftCols = leftTableData.columns;
    const rightCols = rightTableData.columns;
    
    // Create normalized sets for comparison (trimmed)
    const leftColsNormalized = leftCols.map(c => String(c).trim().toLowerCase());
    const rightColsNormalized = rightCols.map(c => String(c).trim().toLowerCase());
    const leftColsSet = new Set(leftColsNormalized);
    const rightColsSet = new Set(rightColsNormalized);
    
    // Create maps from normalized to original column names
    const leftColsMap = new Map<string, string>();
    leftCols.forEach((col, idx) => {
      const normalized = leftColsNormalized[idx];
      if (!leftColsMap.has(normalized)) {
        leftColsMap.set(normalized, col);
      }
    });
    
    const rightColsMap = new Map<string, string>();
    rightCols.forEach((col, idx) => {
      const normalized = rightColsNormalized[idx];
      if (!rightColsMap.has(normalized)) {
        rightColsMap.set(normalized, col);
      }
    });
    
    const leftOnly: string[] = [];
    const rightOnly: string[] = [];
    const both: string[] = [];
    
    // Check each column from left table
    leftCols.forEach((col, idx) => {
      const normalized = leftColsNormalized[idx];
      const inRight = rightColsSet.has(normalized);
      
      if (inRight) {
        // Column exists in both tables
        const rightCol = rightColsMap.get(normalized);
        if (rightCol && !both.includes(col) && !both.includes(rightCol)) {
          both.push(col); // Use left column name as representative
        }
      } else {
        // Column only in left table
        if (!leftOnly.includes(col)) {
          leftOnly.push(col);
        }
      }
    });
    
    // Check each column from right table
    rightCols.forEach((col, idx) => {
      const normalized = rightColsNormalized[idx];
      const inLeft = leftColsSet.has(normalized);
      
      if (!inLeft) {
        // Column only in right table
        if (!rightOnly.includes(col)) {
          rightOnly.push(col);
        }
      }
    });
    
    return { leftOnly, rightOnly, both };
  }, [leftTableData?.columns, rightTableData?.columns]);

  // Initialize selected columns (select all by default when columns change)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => new Set());

  // Update selected columns when allColumns changes (select all by default)
  useEffect(() => {
    if (allColumns.length > 0) {
      setSelectedColumns(new Set(allColumns));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allColumns.length]); // Only depend on length to avoid infinite loop

  // Get columns to compare (only selected ones)
  const columnsToCompare = useMemo(() => {
    return allColumns.filter(col => selectedColumns.has(col));
  }, [allColumns, selectedColumns]);

  // Get columns to display for left table (only selected columns that exist in left table, preserving original order and original column names)
  const leftColumnsToDisplay = useMemo(() => {
    if (!leftTableData?.columns) return [];
    const selectedSet = new Set(columnsToCompare.map(c => String(c).trim()));
    // Preserve original order and original column names from leftTableData.columns
    return leftTableData.columns.filter(col => {
      const colTrimmed = String(col).trim();
      return selectedSet.has(colTrimmed);
    });
  }, [columnsToCompare, leftTableData?.columns]);

  // Get columns to display for right table (only selected columns that exist in right table, preserving original order and original column names)
  const rightColumnsToDisplay = useMemo(() => {
    if (!rightTableData?.columns) return [];
    const selectedSet = new Set(columnsToCompare.map(c => String(c).trim()));
    // Preserve original order and original column names from rightTableData.columns
    return rightTableData.columns.filter(col => {
      const colTrimmed = String(col).trim();
      return selectedSet.has(colTrimmed);
    });
  }, [columnsToCompare, rightTableData?.columns]);

  // Compare rows and find differences
  const comparisonResult = useMemo(() => {
    if (!leftTableData || !rightTableData) return null;

    const leftRows = leftTableData.rows || [];
    const rightRows = rightTableData.rows || [];

    // Create maps for quick lookup using row index as key (since we're comparing by position)
    const differences: Map<number, {
      leftRow?: Record<string, unknown>;
      rightRow?: Record<string, unknown>;
      status: "same" | "different" | "left-only" | "right-only";
      diffColumns?: string[];
    }> = new Map();

    const maxRows = Math.max(leftRows.length, rightRows.length);

    for (let i = 0; i < maxRows; i++) {
      const leftRow = leftRows[i];
      const rightRow = rightRows[i];

      if (!leftRow && rightRow) {
        differences.set(i, {
          rightRow,
          status: "right-only",
        });
      } else if (leftRow && !rightRow) {
        differences.set(i, {
          leftRow,
          status: "left-only",
        });
      } else if (leftRow && rightRow) {
        // Compare values (only for selected columns)
        const diffColumns: string[] = [];
        columnsToCompare.forEach((col) => {
          const leftVal = leftRow[col];
          const rightVal = rightRow[col];
          // Deep comparison for objects/arrays
          if (JSON.stringify(leftVal) !== JSON.stringify(rightVal)) {
            diffColumns.push(col);
          }
        });

        differences.set(i, {
          leftRow,
          rightRow,
          status: diffColumns.length > 0 ? "different" : "same",
          diffColumns,
        });
      }
    }

    return differences;
  }, [leftTableData, rightTableData, columnsToCompare]);

  const isLoading = leftData.isLoading || rightData.isLoading;
  const hasError = leftData.error || rightData.error;

  const content = (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Compare Tables
            </h2>
            <p className="text-xs text-muted-foreground">
              {leftTable.schemaName}.{leftTable.tableName} vs{" "}
              {rightTable.schemaName}.{rightTable.tableName}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading table data...
            </span>
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Database className="h-12 w-12 text-destructive mb-4 opacity-50" />
            <p className="text-sm font-medium text-foreground mb-2">
              Error loading table data
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {leftData.error instanceof Error
                ? leftData.error.message
                : rightData.error instanceof Error
                  ? rightData.error.message
                  : "Unknown error occurred"}
            </p>
          </div>
        ) : leftTableData && rightTableData ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Comparison Stats */}
            <div className="border-b border-border p-2 bg-muted/50">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-muted-foreground">
                    Left: {leftTable.databaseName} ({leftTableData.totalRows}{" "}
                    rows, {leftTableData.columns.length} columns)
                  </span>
                  <span className="text-muted-foreground">
                    Right: {rightTable.databaseName} ({rightTableData.totalRows}{" "}
                    rows, {rightTableData.columns.length} columns)
                  </span>
                  {comparisonResult && (
                    <span className="text-primary font-medium">
                      Differences:{" "}
                      {Array.from(comparisonResult.values()).filter(
                        (d) => d.status !== "same"
                      ).length}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Comparing: {columnsToCompare.length} of {allColumns.length} columns
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="gap-2 text-xs"
                  >
                    <Settings2 className="h-3 w-3" />
                    Select Columns
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Limit:
                  </span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {LIMIT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Column Selector */}
              {showColumnSelector && (
                <div className="mt-3 p-3 border border-border rounded-md bg-background">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Select columns to compare:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedColumns(new Set(allColumns))}
                        className="text-xs h-6"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedColumns(new Set())}
                        className="text-xs h-6"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex pace-y-4">
                    {/* Common Columns (Both Tables) */}
                    {columnCategories.both.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-4 rounded bg-primary/20 border border-primary/50"></div>
                          <span className="text-xs font-semibold text-foreground">
                            Common Columns ({columnCategories.both.length})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            - Present in both tables
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ml-6">
                          {columnCategories.both.map((column) => {
                            const isSelected = selectedColumns.has(column);
                            return (
                              <label
                                key={column}
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-xs border border-primary/20"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedColumns);
                                    if (e.target.checked) {
                                      newSelected.add(column);
                                    } else {
                                      newSelected.delete(column);
                                    }
                                    setSelectedColumns(newSelected);
                                  }}
                                  className="h-4 w-4 rounded border-input cursor-pointer"
                                />
                                <span className="flex-1 truncate" title={column}>
                                  {column}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Left Table Only Columns */}
                    {columnCategories.leftOnly.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-4 rounded bg-blue-500/20 border border-blue-500/50"></div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            Left Table Only ({columnCategories.leftOnly.length})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            - {leftTable.databaseName}
                          </span>
                        </div>
                        <ScrollArea className="max-h-[200px] overflow-y-auto">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ml-6">
                          {columnCategories.leftOnly.map((column) => {
                            const isSelected = selectedColumns.has(column);
                            return (
                              <label
                                key={column}
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-xs border border-blue-500/20 bg-blue-500/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedColumns);
                                    if (e.target.checked) {
                                      newSelected.add(column);
                                    } else {
                                      newSelected.delete(column);
                                    }
                                    setSelectedColumns(newSelected);
                                  }}
                                  className="h-4 w-4 rounded border-input cursor-pointer"
                                />
                                <span className="flex-1 truncate" title={column}>
                                  {column}
                                </span>
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium" title="Only in left table">
                                  L
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Right Table Only Columns */}
                    {columnCategories.rightOnly.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-4 rounded bg-green-500/20 border border-green-500/50"></div>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            Right Table Only ({columnCategories.rightOnly.length})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            - {rightTable.databaseName}
                          </span>
                        </div>
                        <ScrollArea className="max-h-[200px] overflow-y-auto">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ml-6">
                          {columnCategories.rightOnly.map((column) => {
                            const isSelected = selectedColumns.has(column);
                            return (
                              <label
                                key={column}
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-xs border border-green-500/20 bg-green-500/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedColumns);
                                    if (e.target.checked) {
                                      newSelected.add(column);
                                    } else {
                                      newSelected.delete(column);
                                    }
                                    setSelectedColumns(newSelected);
                                  }}
                                  className="h-4 w-4 rounded border-input cursor-pointer"
                                />
                                <span className="flex-1 truncate" title={column}>
                                  {column}
                                </span>
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium" title="Only in right table">
                                  R
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Side by Side Tables */}
            <div className="flex-1 grid grid-cols-2 gap-0 min-h-0 overflow-hidden">
              {/* Left Table */}
              <div className="flex flex-col border-r border-border min-h-0">
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">
                      {leftTable.databaseName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {leftTable.schemaName}.{leftTable.tableName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({leftColumnsToDisplay.length} columns)
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                    <Table containerClassName={cn("h-full max-w-[45vw] mx-auto px-4",showColumnSelector ? "max-h-[calc(100vh-600px)]" : "max-h-[500px]")}>
                      <TableHeader>
                        <TableRow>
                          {leftColumnsToDisplay.map((column) => (
                            <TableHead key={column} className="font-semibold p-2 text-xs">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leftTableData.rows.length > 0 ? (
                          leftTableData.rows.map((row, rowIndex) => {
                            const diff = comparisonResult?.get(rowIndex);
                            const isDifferent =
                              diff?.status === "different" ||
                              diff?.status === "left-only";

                            return (
                              <TableRow
                                key={rowIndex}
                                className={
                                  isDifferent
                                    ? "bg-destructive/10 hover:bg-destructive/20"
                                    : ""
                                }
                              >
                                {leftColumnsToDisplay.map((column) => {
                                  const isDiffColumn =
                                    diff?.diffColumns?.includes(column);
                                  return (
                                    <TableCell
                                      key={column}
                                      className={`max-w-xs p-2 text-xs ${
                                        isDiffColumn
                                          ? "bg-destructive/20 font-semibold"
                                          : ""
                                      }`}
                                    >
                                      <ImageCell value={row[column]} />
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={leftColumnsToDisplay.length}
                              className="text-center py-8 text-muted-foreground text-xs"
                            >
                              No data
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                </div>
              </div>

              {/* Right Table */}
              <div className="flex flex-col min-h-0">
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">
                      {rightTable.databaseName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rightTable.schemaName}.{rightTable.tableName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({rightColumnsToDisplay.length} columns)
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                    <Table containerClassName={cn("h-full max-w-[45vw] mx-auto px-4",showColumnSelector ? "max-h-[calc(100vh-600px)]" : "max-h-[500px]")}>
                      <TableHeader>
                        <TableRow>
                          {rightColumnsToDisplay.map((column) => (
                            <TableHead key={column} className="font-semibold p-2 text-xs">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rightTableData.rows.length > 0 ? (
                          rightTableData.rows.map((row, rowIndex) => {
                            const diff = comparisonResult?.get(rowIndex);
                            const isDifferent =
                              diff?.status === "different" ||
                              diff?.status === "right-only";

                            return (
                              <TableRow
                                key={rowIndex}
                                className={
                                  isDifferent
                                    ? "bg-destructive/10 hover:bg-destructive/20"
                                    : ""
                                }
                              >
                                {rightColumnsToDisplay.map((column) => {
                                  const isDiffColumn =
                                    diff?.diffColumns?.includes(column);
                                  return (
                                    <TableCell
                                      key={column}
                                      className={`max-w-xs p-2 text-xs ${
                                        isDiffColumn
                                          ? "bg-destructive/20 font-semibold"
                                          : ""
                                      }`}
                                    >
                                      <ImageCell value={row[column]} />
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={rightColumnsToDisplay.length}
                              className="text-center py-8 text-muted-foreground text-xs"
                            >
                              No data
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (asDialog) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] w-full pb-12" showCloseButton={true}>
          <DialogHeader className="sr-only">
            <DialogTitle>
              Compare Tables: {leftTable.schemaName}.{leftTable.tableName} vs{" "}
              {rightTable.schemaName}.{rightTable.tableName}
            </DialogTitle>
            <DialogDescription>
              Comparing data from {leftTable.databaseName} and{" "}
              {rightTable.databaseName} databases
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}

