/**
 * Utility functions for table column operations
 */

import { HIDDEN_COLUMNS, HIDDEN_COLUMN_PATTERNS } from '@/lib/constants/table-constants';

/**
 * Normalizes column names for comparison (trim and lowercase)
 */
export function normalizeColumnName(column: string | number): string {
  return String(column).trim().toLowerCase();
}

/**
 * Checks if a column should be hidden based on constants
 * @param columnName - The column name to check
 * @returns true if the column should be hidden, false otherwise
 */
export function shouldHideColumn(columnName: string | number): boolean {
  const colStr = String(columnName).trim();
  const colLower = colStr.toLowerCase();
  
  // Check exact matches (case-insensitive)
  if (HIDDEN_COLUMNS.some((hidden: string) => colLower === hidden.toLowerCase())) {
    return true;
  }
  
  // Check patterns (endsWith)
  if (HIDDEN_COLUMN_PATTERNS.some((pattern: string) => colStr.endsWith(pattern))) {
    return true;
  }
  
  return false;
}

/**
 * Filters out hidden columns from a column array
 * @param columns - Array of column names
 * @returns Filtered array with hidden columns removed
 */
export function filterHiddenColumns(columns: (string | number)[] | null | undefined): string[] {
  if (!columns || !Array.isArray(columns) || columns.length === 0) return [];
  
  return columns
    .filter(col => !shouldHideColumn(col))
    .map(col => String(col));
}

/**
 * Creates a normalized set from column array for fast lookup
 */
export function createColumnSet(columns: (string | number)[]): Set<string> {
  return new Set(columns.map(normalizeColumnName));
}

/**
 * Categorizes columns by comparing left and right table columns
 */
export interface ColumnCategories {
  leftOnly: string[];
  rightOnly: string[];
  both: string[];
}

export function categorizeColumns(
  leftColumns: (string | number)[],
  rightColumns: (string | number)[]
): ColumnCategories {
  const leftOnly: string[] = [];
  const rightOnly: string[] = [];
  const both: string[] = [];

  // Normalize columns
  const leftColsNormalized = leftColumns.map(normalizeColumnName);
  const rightColsNormalized = rightColumns.map(normalizeColumnName);
  const leftColsSet = new Set(leftColsNormalized);
  const rightColsSet = new Set(rightColsNormalized);

  // Create maps from normalized to original column names
  const leftColsMap = new Map<string, string>();
  leftColumns.forEach((col, idx) => {
    const normalized = leftColsNormalized[idx];
    if (!leftColsMap.has(normalized)) {
      leftColsMap.set(normalized, String(col));
    }
  });

  const rightColsMap = new Map<string, string>();
  rightColumns.forEach((col, idx) => {
    const normalized = rightColsNormalized[idx];
    if (!rightColsMap.has(normalized)) {
      rightColsMap.set(normalized, String(col));
    }
  });

  // Check each column from left table
  leftColumns.forEach((col, idx) => {
    const normalized = leftColsNormalized[idx];
    const inRight = rightColsSet.has(normalized);
    const colStr = String(col);

    if (inRight) {
      // Column exists in both tables
      const rightCol = rightColsMap.get(normalized);
      if (rightCol && !both.includes(colStr) && !both.includes(rightCol)) {
        both.push(colStr); // Use left column name as representative
      }
    } else {
      // Column only in left table
      if (!leftOnly.includes(colStr)) {
        leftOnly.push(colStr);
      }
    }
  });

  // Check each column from right table
  rightColumns.forEach((col, idx) => {
    const normalized = rightColsNormalized[idx];
    const inLeft = leftColsSet.has(normalized);
    const colStr = String(col);

    if (!inLeft) {
      // Column only in right table
      if (!rightOnly.includes(colStr)) {
        rightOnly.push(colStr);
      }
    }
  });

  return { leftOnly, rightOnly, both };
}

/**
 * Filters columns to display based on selected columns, preserving original order
 */
export function getColumnsToDisplay(
  tableColumns: (string | number)[],
  selectedColumns: Set<string>
): string[] {
  if (!tableColumns || tableColumns.length === 0) return [];
  
  const selectedSet = new Set(
    Array.from(selectedColumns).map(normalizeColumnName)
  );
  
  // Preserve original order and original column names
  return tableColumns
    .filter((col) => {
      const colTrimmed = normalizeColumnName(col);
      return selectedSet.has(colTrimmed);
    })
    .map((col) => String(col));
}

