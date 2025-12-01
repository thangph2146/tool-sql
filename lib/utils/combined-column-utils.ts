/**
 * Utility functions for handling combined columns in table comparison
 */

import type { CombinedColumn } from "@/components/database/comparison/column-selector";

/**
 * Gets the actual value for a column (original or combined)
 */
export function getColumnValue(
  row: Record<string, unknown>,
  columnName: string,
  combinedColumns: CombinedColumn[]
): unknown {
  // Check if this is a combined column
  const combined = combinedColumns.find((col) => col.name === columnName);
  if (combined) {
    // Combine values from source columns
    const values = combined.sourceColumns.map((sourceCol) => row[sourceCol]);
    // Join with space, filter out null/undefined
    return values
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => String(v))
      .join(" ");
  }
  
  // Return original column value
  return row[columnName];
}

/**
 * Creates a mapping from display column names to original column names
 * This ensures backward compatibility
 */
export function createColumnMapping(
  columns: string[],
  combinedColumns: CombinedColumn[]
): Map<string, string[]> {
  const mapping = new Map<string, string[]>();
  
  // Map original columns to themselves
  columns.forEach((col) => {
    mapping.set(col, [col]);
  });
  
  // Map combined columns to their source columns
  combinedColumns.forEach((combined) => {
    mapping.set(combined.name, combined.sourceColumns);
  });
  
  return mapping;
}

/**
 * Validates that combined columns have valid source columns in the table
 */
export function validateCombinedColumns(
  combinedColumns: CombinedColumn[],
  availableColumns: string[]
): {
  valid: CombinedColumn[];
  invalid: CombinedColumn[];
} {
  const valid: CombinedColumn[] = [];
  const invalid: CombinedColumn[] = [];
  
  combinedColumns.forEach((combined) => {
    const allSourcesExist = combined.sourceColumns.every((source) =>
      availableColumns.includes(source)
    );
    
    if (allSourcesExist) {
      valid.push(combined);
    } else {
      invalid.push(combined);
    }
  });
  
  return { valid, invalid };
}

/**
 * Gets all columns (original + combined) for a side
 */
export function getAllColumnsForSide(
  originalColumns: string[],
  combinedColumns: CombinedColumn[],
  side: "left" | "right"
): string[] {
  const sideCombined = combinedColumns
    .filter((col) => col.side === side)
    .map((col) => col.name);
  
  return [...originalColumns, ...sideCombined];
}

