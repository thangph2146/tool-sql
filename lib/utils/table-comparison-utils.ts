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
export function normalizeForComparison(value: unknown): unknown {
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
 * Creates a comparison key from row values using normalized values
 */
function createComparisonKey(row: Record<string, unknown>, columnsToCompare: string[]): string {
  return columnsToCompare
    .map(col => {
      const val = row[col];
      // Use normalizeForComparison to extract actual value and normalize
      const normalized = normalizeForComparison(val);
      if (normalized === null || normalized === undefined) {
        return 'null';
      }
      // For objects/arrays, use JSON.stringify for consistent key
      if (typeof normalized === 'object') {
        try {
          return JSON.stringify(normalized);
        } catch {
          return String(normalized);
        }
      }
      // For strings, use lowercase for case-insensitive comparison
      if (typeof normalized === 'string') {
        return normalized.toLowerCase();
      }
      return String(normalized);
    })
    .join('|');
}

/**
 * Checks if a row is a null row (all values are null)
 */
export function isNullRow(row: Record<string, unknown>, columnsToCheck: string[]): boolean {
  if (columnsToCheck.length === 0) {
    // If no columns to check, check all keys
    return Object.values(row).every(val => val === null || val === undefined);
  }
  return columnsToCheck.every(col => row[col] === null || row[col] === undefined);
}

/**
 * Compares all rows from two tables by matching rows based on comparison columns
 * When rows are synchronized (same count), compares row-by-row by index
 * When rows are not synchronized, uses matching logic
 * Returns a map where key is the row index and value is the comparison result
 */
export function compareAllRows(
  leftRows: Record<string, unknown>[],
  rightRows: Record<string, unknown>[],
  columnsToCompare: string[]
): Map<number, ComparisonResult> {
  const differences = new Map<number, ComparisonResult>();
  
  const leftRowCount = leftRows.length;
  const rightRowCount = rightRows.length;
  const rowsAreSynchronized = leftRowCount === rightRowCount;
  
  // If rows are synchronized (same count), compare row-by-row by index
  if (rowsAreSynchronized) {
    leftRows.forEach((leftRow, index) => {
      const rightRow = rightRows[index];
      
      // Check if either row is a null row (padded row)
      const leftIsNull = isNullRow(leftRow, columnsToCompare.length > 0 ? columnsToCompare : Object.keys(leftRow));
      const rightIsNull = isNullRow(rightRow, columnsToCompare.length > 0 ? columnsToCompare : Object.keys(rightRow));
      
      if (leftIsNull && rightIsNull) {
        // Both are null rows - skip (shouldn't happen, but handle gracefully)
        differences.set(index, {
          leftRow,
          rightRow,
          status: "same",
        });
      } else if (leftIsNull) {
        // Left is null row - this is a right-only row
        differences.set(index, {
          rightRow,
          status: "right-only",
        });
      } else if (rightIsNull) {
        // Right is null row - this is a left-only row
        differences.set(index, {
          leftRow,
          status: "left-only",
        });
      } else {
        // Both rows have data - compare them
        if (columnsToCompare.length === 0) {
          // No columns to compare - mark as different
          differences.set(index, {
            leftRow,
            rightRow,
            status: "different",
          });
        } else {
          // Compare using the specified columns
          const comparison = compareRows(leftRow, rightRow, columnsToCompare);
          differences.set(index, comparison);
        }
      }
    });
    
    return differences;
  }
  
  // If rows are not synchronized, use matching logic
  // Determine which table has more rows - use that as the base for comparison
  const useLeftAsBase = leftRowCount >= rightRowCount;
  
  // If no columns to compare, mark all based on which table has more rows
  if (columnsToCompare.length === 0) {
    if (useLeftAsBase) {
      leftRows.forEach((_, index) => {
        differences.set(index, {
          leftRow: leftRows[index],
          status: "left-only",
        });
      });
      rightRows.forEach((_, index) => {
        const virtualIndex = leftRows.length + index;
        differences.set(virtualIndex, {
          rightRow: rightRows[index],
          status: "right-only",
        });
      });
    } else {
      rightRows.forEach((_, index) => {
        differences.set(index, {
          rightRow: rightRows[index],
          status: "right-only",
        });
      });
      leftRows.forEach((_, index) => {
        const virtualIndex = rightRows.length + index;
        differences.set(virtualIndex, {
          leftRow: leftRows[index],
          status: "left-only",
        });
      });
    }
    return differences;
  }

  if (useLeftAsBase) {
    // Left table has more rows - use left as base, match with right
    const rightRowMap = new Map<string, { row: Record<string, unknown>; index: number }>();
    rightRows.forEach((rightRow, rightIndex) => {
      // Skip null rows when building the map
      if (!isNullRow(rightRow, columnsToCompare)) {
        const key = createComparisonKey(rightRow, columnsToCompare);
        if (!rightRowMap.has(key)) {
          rightRowMap.set(key, { row: rightRow, index: rightIndex });
        }
      }
    });

    const matchedRightIndices = new Set<number>();

    // Compare each left row (base) with right rows
    leftRows.forEach((leftRow, leftIndex) => {
      // Skip null rows
      if (isNullRow(leftRow, columnsToCompare)) {
        differences.set(leftIndex, {
          leftRow,
          status: "left-only",
        });
        return;
      }
      
      const leftKey = createComparisonKey(leftRow, columnsToCompare);
      const matchedRight = rightRowMap.get(leftKey);
      
      if (matchedRight) {
        const comparison = compareRows(leftRow, matchedRight.row, columnsToCompare);
        differences.set(leftIndex, comparison);
        matchedRightIndices.add(matchedRight.index);
      } else {
        differences.set(leftIndex, {
          leftRow,
          status: "left-only",
        });
      }
    });

    // Add right-only rows (right rows that were not matched and are not null)
    rightRows.forEach((rightRow, rightIndex) => {
      if (!matchedRightIndices.has(rightIndex) && !isNullRow(rightRow, columnsToCompare)) {
        const virtualIndex = leftRows.length + rightIndex;
        differences.set(virtualIndex, {
          rightRow,
          status: "right-only",
        });
      }
    });
  } else {
    // Right table has more rows - use right as base, match with left
    const leftRowMap = new Map<string, { row: Record<string, unknown>; index: number }>();
    leftRows.forEach((leftRow, leftIndex) => {
      // Skip null rows when building the map
      if (!isNullRow(leftRow, columnsToCompare)) {
        const key = createComparisonKey(leftRow, columnsToCompare);
        if (!leftRowMap.has(key)) {
          leftRowMap.set(key, { row: leftRow, index: leftIndex });
        }
      }
    });

    const matchedLeftIndices = new Set<number>();

    // Compare each right row (base) with left rows
    rightRows.forEach((rightRow, rightIndex) => {
      // Skip null rows
      if (isNullRow(rightRow, columnsToCompare)) {
        differences.set(rightIndex, {
          rightRow,
          status: "right-only",
        });
        return;
      }
      
      const rightKey = createComparisonKey(rightRow, columnsToCompare);
      const matchedLeft = leftRowMap.get(rightKey);
      
      if (matchedLeft) {
        const comparison = compareRows(matchedLeft.row, rightRow, columnsToCompare);
        differences.set(rightIndex, comparison);
        matchedLeftIndices.add(matchedLeft.index);
      } else {
        differences.set(rightIndex, {
          rightRow,
          status: "right-only",
        });
      }
    });

    // Add left-only rows (left rows that were not matched and are not null)
    leftRows.forEach((leftRow, leftIndex) => {
      if (!matchedLeftIndices.has(leftIndex) && !isNullRow(leftRow, columnsToCompare)) {
        const virtualIndex = rightRows.length + leftIndex;
        differences.set(virtualIndex, {
          leftRow,
          status: "left-only",
        });
      }
    });
  }

  return differences;
}

