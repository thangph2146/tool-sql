import { useState, useMemo, useCallback } from 'react';

export type SortOrder = 'alphabetical' | 'reverse' | 'newest' | 'oldest';

export interface SortConfig {
  column: string;
  order: SortOrder;
}

interface UseTableSortingReturn {
  sortColumns: SortConfig[];
  handleSort: (column: string) => void;
  handleSortOrderChange: (column: string, order: SortOrder) => void;
  handleRemoveSort: (column: string) => void;
  sortedRows: Record<string, unknown>[];
  originalToSortedIndexMap: Map<number, number>;
}

/**
 * Custom hook for table row sorting
 * Handles multi-column sorting with different sort orders
 */
export function useTableSorting(
  rows: Record<string, unknown>[]
): UseTableSortingReturn {
  const [sortColumns, setSortColumns] = useState<SortConfig[]>([]);

  const handleSort = useCallback((column: string) => {
    setSortColumns((prev) => {
      const existingIndex = prev.findIndex((s) => s.column === column);
      if (existingIndex >= 0) {
        // Remove if already exists
        return prev.filter((_, i) => i !== existingIndex);
      } else {
        // Add new column with default alphabetical sort
        return [...prev, { column, order: 'alphabetical' }];
      }
    });
  }, []);

  const handleSortOrderChange = useCallback(
    (column: string, order: SortOrder) => {
      setSortColumns((prev) =>
        prev.map((s) => (s.column === column ? { ...s, order } : s))
      );
    },
    []
  );

  const handleRemoveSort = useCallback((column: string) => {
    setSortColumns((prev) => prev.filter((s) => s.column !== column));
  }, []);

  // Sort rows based on multiple sortColumns
  // Also create a mapping from original index to sorted index
  const sortedRowsData = useMemo(() => {
    if (sortColumns.length === 0) {
      // No sorting, create identity map
      const identityMap = new Map<number, number>();
      rows.forEach((_, index) => identityMap.set(index, index));
      return { sortedRows: rows, originalToSortedIndexMap: identityMap };
    }

    // Create array with original indices
    const rowsWithIndices = rows.map((row, originalIndex) => ({
      row,
      originalIndex,
    }));

    // Sort with original indices preserved
    const sorted = rowsWithIndices.sort((a, b) => {
      // Sort by each column in order
      for (const { column, order } of sortColumns) {
        const aValue = a.row[column];
        const bValue = b.row[column];

        // Handle null/undefined values
        if (aValue == null && bValue == null) continue;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        let comparison = 0;

        // Try date comparison first (for date columns)
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));
        if (
          !isNaN(aDate.getTime()) &&
          !isNaN(bDate.getTime()) &&
          aDate.getTime() !== 0 &&
          bDate.getTime() !== 0
        ) {
          // Valid dates
          comparison = aDate.getTime() - bDate.getTime();
        } else {
          // Try numeric comparison
          const aNum = Number(aValue);
          const bNum = Number(bValue);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            comparison = aNum - bNum;
          } else {
            // String comparison
            const aStr = String(aValue).toLowerCase();
            const bStr = String(bValue).toLowerCase();
            comparison = aStr.localeCompare(bStr, 'vi', {
              numeric: true,
              sensitivity: 'base',
            });
          }
        }

        // Apply sort order
        if (order === 'reverse') {
          // Reverse = Z-A (ngược)
          comparison = -comparison;
        } else if (order === 'newest') {
          // Newest = lớn nhất/cuối cùng lên đầu (reverse)
          comparison = -comparison;
        } else if (order === 'oldest') {
          // Oldest = nhỏ nhất/đầu tiên lên đầu (normal)
          // Keep original comparison
        }
        // "alphabetical" keeps original comparison

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }
        // If equal, continue to next sort column
      }
      return 0;
    });

    // Extract sorted rows and create mapping
    const sortedRowsResult = sorted.map((item) => item.row);
    const indexMap = new Map<number, number>();
    sorted.forEach((item, sortedIndex) => {
      indexMap.set(item.originalIndex, sortedIndex);
    });

    return { sortedRows: sortedRowsResult, originalToSortedIndexMap: indexMap };
  }, [rows, sortColumns]);

  return {
    sortColumns,
    handleSort,
    handleSortOrderChange,
    handleRemoveSort,
    sortedRows: sortedRowsData.sortedRows,
    originalToSortedIndexMap: sortedRowsData.originalToSortedIndexMap,
  };
}

