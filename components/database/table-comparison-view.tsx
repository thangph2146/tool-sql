"use client";

import { useState, useMemo } from "react";
import {
  Loader2,
  Database,
  GitCompare,
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
    const leftCols = leftTableData?.columns || [];
    const rightCols = rightTableData?.columns || [];
    const uniqueCols = new Set([...leftCols, ...rightCols]);
    return Array.from(uniqueCols).sort();
  }, [leftTableData?.columns, rightTableData?.columns]);

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
        // Compare values
        const diffColumns: string[] = [];
        allColumns.forEach((col) => {
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
  }, [leftTableData, rightTableData, allColumns]);

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
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    Left: {leftTable.databaseName} ({leftTableData.totalRows}{" "}
                    rows)
                  </span>
                  <span className="text-muted-foreground">
                    Right: {rightTable.databaseName} ({rightTableData.totalRows}{" "}
                    rows)
                  </span>
                  {comparisonResult && (
                    <span className="text-primary font-medium">
                      Differences:{" "}
                      {Array.from(comparisonResult.values()).filter(
                        (d) => d.status !== "same"
                      ).length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                    <Table containerClassName="h-full max-h-[500px] max-w-[45vw] mx-auto px-4">
                      <TableHeader>
                        <TableRow>
                          {leftTableData.columns.map((column) => (
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
                                {leftTableData.columns.map((column) => {
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
                              colSpan={leftTableData.columns.length}
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
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                    <Table containerClassName="h-full max-h-[500px] max-w-[45vw] mx-auto px-4">
                      <TableHeader>
                        <TableRow>
                          {rightTableData.columns.map((column) => (
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
                                {rightTableData.columns.map((column) => {
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
                              colSpan={rightTableData.columns.length}
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

