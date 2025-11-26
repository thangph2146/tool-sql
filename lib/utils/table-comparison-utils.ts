/**
 * Utility functions for table comparison operations
 */

/**
 * Efficiently compares two values without using JSON.stringify
 */
function compareValues(left: unknown, right: unknown): boolean {
  // Handle null/undefined
  if (left === null || left === undefined) {
    return right === null || right === undefined;
  }
  if (right === null || right === undefined) {
    return false;
  }

  // Handle primitives
  if (typeof left !== "object" || typeof right !== "object") {
    return left === right;
  }

  // Handle arrays
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (!compareValues(left[i], right[i])) return false;
    }
    return true;
  }

  // Handle objects (including Buffer)
  if (typeof left === "object" && typeof right === "object") {
    // Check for Buffer objects
    if (
      "type" in left &&
      "data" in left &&
      left.type === "Buffer" &&
      "type" in right &&
      "data" in right &&
      right.type === "Buffer"
    ) {
      const leftData = left.data as number[];
      const rightData = right.data as number[];
      if (leftData.length !== rightData.length) return false;
      for (let i = 0; i < leftData.length; i++) {
        if (leftData[i] !== rightData[i]) return false;
      }
      return true;
    }

    // Regular object comparison
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    for (const key of leftKeys) {
      if (!(key in right)) return false;
      if (!compareValues((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])) {
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

