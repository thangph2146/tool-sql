/**
 * Utility functions for table comparison operations
 */

/**
 * Extracts the actual value from display value (removes "\n(ID: ...)" part)
 * Example: "Bùi Công  Sơn\n(ID: 5D66C4AD-41D2-47CB-8672-0981349..." => "Bùi Công  Sơn"
 */
function extractActualValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // If not a string, return as is
  if (typeof value !== "string") {
    return value;
  }

  const strValue = value;
  
  // Check if value contains "\n(ID: " pattern (display value with ID)
  const idPattern = /\n\(ID:\s*[^)]+\)/;
  if (idPattern.test(strValue)) {
    // Extract only the part before "\n(ID: "
    const actualValue = strValue.split('\n(ID:')[0].trim();
    // Return empty string if result is empty, otherwise return trimmed value
    return actualValue.length > 0 ? actualValue : value;
  }
  
  // Also check for pattern without newline: "(ID: ...)" at the end
  const idPatternEnd = /\(ID:\s*[^)]+\)$/;
  if (idPatternEnd.test(strValue)) {
    const actualValue = strValue.replace(idPatternEnd, '').trim();
    return actualValue.length > 0 ? actualValue : value;
  }
  
  return value;
}

/**
 * Normalizes values for comparison (extracts actual value and normalizes)
 */
function normalizeForComparison(value: unknown): unknown {
  const actual = extractActualValue(value);
  
  // Normalize strings: trim and handle empty strings
  if (typeof actual === "string") {
    const trimmed = actual.trim();
    // Return null for empty strings to treat them as null
    return trimmed.length === 0 ? null : trimmed;
  }
  
  return actual;
}

/**
 * Efficiently compares two values without using JSON.stringify
 * Handles display values by extracting actual values before comparison
 */
function compareValues(left: unknown, right: unknown): boolean {
  // Normalize values (extract actual values and normalize)
  const leftNormalized = normalizeForComparison(left);
  const rightNormalized = normalizeForComparison(right);

  // Handle null/undefined
  if (leftNormalized === null || leftNormalized === undefined) {
    return rightNormalized === null || rightNormalized === undefined;
  }
  if (rightNormalized === null || rightNormalized === undefined) {
    return false;
  }

  // Handle primitives
  if (typeof leftNormalized !== "object" || typeof rightNormalized !== "object") {
    // For strings, do case-insensitive comparison
    if (typeof leftNormalized === "string" && typeof rightNormalized === "string") {
      return leftNormalized.toLowerCase() === rightNormalized.toLowerCase();
    }
    return leftNormalized === rightNormalized;
  }

  // Handle arrays
  if (Array.isArray(leftNormalized) && Array.isArray(rightNormalized)) {
    if (leftNormalized.length !== rightNormalized.length) return false;
    for (let i = 0; i < leftNormalized.length; i++) {
      if (!compareValues(leftNormalized[i], rightNormalized[i])) return false;
    }
    return true;
  }

  // Handle objects (including Buffer)
  if (typeof leftNormalized === "object" && typeof rightNormalized === "object") {
    // Check for Buffer objects
    if (
      "type" in leftNormalized &&
      "data" in leftNormalized &&
      (leftNormalized as { type: string }).type === "Buffer" &&
      "type" in rightNormalized &&
      "data" in rightNormalized &&
      (rightNormalized as { type: string }).type === "Buffer"
    ) {
      const leftData = (leftNormalized as { data: number[] }).data;
      const rightData = (rightNormalized as { data: number[] }).data;
      if (leftData.length !== rightData.length) return false;
      for (let i = 0; i < leftData.length; i++) {
        if (leftData[i] !== rightData[i]) return false;
      }
      return true;
    }

    // Regular object comparison
    const leftKeys = Object.keys(leftNormalized);
    const rightKeys = Object.keys(rightNormalized);
    if (leftKeys.length !== rightKeys.length) return false;

    for (const key of leftKeys) {
      if (!(key in rightNormalized)) return false;
      if (!compareValues((leftNormalized as Record<string, unknown>)[key], (rightNormalized as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

export interface ComparisonResult {
  leftRow?: Record<string, unknown>;
  rightRow?: Record<string, unknown>;
  status: "same" | "different" | "left-only" | "right-only";
  diffColumns?: string[];
}

/**
 * Compares two table rows and returns comparison result
 */
export function compareRows(
  leftRow: Record<string, unknown> | undefined,
  rightRow: Record<string, unknown> | undefined,
  columnsToCompare: string[]
): ComparisonResult {
  if (!leftRow && rightRow) {
    return {
      rightRow,
      status: "right-only",
    };
  }

  if (leftRow && !rightRow) {
    return {
      leftRow,
      status: "left-only",
    };
  }

  if (!leftRow || !rightRow) {
    return {
      status: "same",
    };
  }

  // Compare values for selected columns
  const diffColumns: string[] = [];
  for (const col of columnsToCompare) {
    const leftVal = leftRow[col];
    const rightVal = rightRow[col];
    if (!compareValues(leftVal, rightVal)) {
      diffColumns.push(col);
    }
  }

  return {
    leftRow,
    rightRow,
    status: diffColumns.length > 0 ? "different" : "same",
    diffColumns: diffColumns.length > 0 ? diffColumns : undefined,
  };
}

/**
 * Compares all rows from two tables
 */
export function compareAllRows(
  leftRows: Record<string, unknown>[],
  rightRows: Record<string, unknown>[],
  columnsToCompare: string[]
): Map<number, ComparisonResult> {
  const differences = new Map<number, ComparisonResult>();
  const maxRows = Math.max(leftRows.length, rightRows.length);

  for (let i = 0; i < maxRows; i++) {
    const leftRow = leftRows[i];
    const rightRow = rightRows[i];
    differences.set(i, compareRows(leftRow, rightRow, columnsToCompare));
  }

  return differences;
}

