/**
 * Custom hook for synchronizing rows between two tables
 * Ensures rows with same values are at the same index
 */

import { useMemo, useCallback } from 'react';
import { normalizeForComparison } from '@/lib/utils/table-comparison-utils';

interface UseRowSynchronizationProps {
  leftRows: Record<string, unknown>[];
  rightRows: Record<string, unknown>[];
  columnsToCompare: string[];
  leftTableColumns?: string[];
  rightTableColumns?: string[];
}

export function useRowSynchronization({
  leftRows,
  rightRows,
  columnsToCompare,
  leftTableColumns = [],
  rightTableColumns = [],
}: UseRowSynchronizationProps) {
  // Helper function to create comparison key
  const createSortKey = useCallback((row: Record<string, unknown>, columns: string[]): string => {
    if (columns.length === 0) return '';
    return columns
      .map(col => {
        const val = row[col];
        const normalized = normalizeForComparison(val);
        if (normalized === null || normalized === undefined) {
          return 'null';
        }
        if (typeof normalized === 'object') {
          try {
            return JSON.stringify(normalized);
          } catch {
            return String(normalized);
          }
        }
        if (typeof normalized === 'string') {
          return normalized.toLowerCase();
        }
        return String(normalized);
      })
      .join('|');
  }, []);

  // Helper function to get all unique column names from rows
  const getAllColumnsFromRows = useCallback((rows: Record<string, unknown>[]): string[] => {
    if (rows.length === 0) return [];
    const allColumns = new Set<string>();
    rows.forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key));
    });
    return Array.from(allColumns);
  }, []);

  // Helper function to create a null row with all columns set to null
  const createNullRow = useCallback((columns: string[]): Record<string, unknown> => {
    const nullRow: Record<string, unknown> = {};
    columns.forEach(col => { nullRow[col] = null; });
    return nullRow;
  }, []);

  const { synchronizedLeftRows, synchronizedRightRows } = useMemo(() => {
    // Get all columns from actual rows to ensure null rows have the same structure
    const leftAllColumns = leftRows.length > 0 
      ? getAllColumnsFromRows(leftRows)
      : leftTableColumns;
    const rightAllColumns = rightRows.length > 0 
      ? getAllColumnsFromRows(rightRows)
      : rightTableColumns;

    if (columnsToCompare.length === 0) {
      // No columns to compare, just pad with null rows
      const leftCount = leftRows.length;
      const rightCount = rightRows.length;
      const maxCount = Math.max(leftCount, rightCount);
      
      const alignedLeft: Record<string, unknown>[] = [...leftRows];
      const alignedRight: Record<string, unknown>[] = [...rightRows];
      
      // Pad left if needed
      if (leftCount < maxCount) {
        for (let i = leftCount; i < maxCount; i++) {
          alignedLeft.push(createNullRow(leftAllColumns));
        }
      }
      
      // Pad right if needed
      if (rightCount < maxCount) {
        for (let i = rightCount; i < maxCount; i++) {
          alignedRight.push(createNullRow(rightAllColumns));
        }
      }
      
      return { synchronizedLeftRows: alignedLeft, synchronizedRightRows: alignedRight };
    }

    // Create maps of rows by their comparison key
    const leftRowMap = new Map<string, Record<string, unknown>[]>();
    leftRows.forEach(row => {
      const key = createSortKey(row, columnsToCompare);
      if (!leftRowMap.has(key)) {
        leftRowMap.set(key, []);
      }
      leftRowMap.get(key)!.push(row);
    });

    const rightRowMap = new Map<string, Record<string, unknown>[]>();
    rightRows.forEach(row => {
      const key = createSortKey(row, columnsToCompare);
      if (!rightRowMap.has(key)) {
        rightRowMap.set(key, []);
      }
      rightRowMap.get(key)!.push(row);
    });

    // Get all unique keys and sort them
    const allKeys = Array.from(new Set([...leftRowMap.keys(), ...rightRowMap.keys()]));
    allKeys.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));

    // Build aligned arrays
    const alignedLeft: Record<string, unknown>[] = [];
    const alignedRight: Record<string, unknown>[] = [];

    allKeys.forEach(key => {
      const leftRowsForKey = leftRowMap.get(key) || [];
      const rightRowsForKey = rightRowMap.get(key) || [];
      const maxCount = Math.max(leftRowsForKey.length, rightRowsForKey.length);

      // Add matched rows
      for (let i = 0; i < maxCount; i++) {
        if (i < leftRowsForKey.length && i < rightRowsForKey.length) {
          // Both have rows at this position - match them
          alignedLeft.push(leftRowsForKey[i]);
          alignedRight.push(rightRowsForKey[i]);
        } else if (i < leftRowsForKey.length) {
          // Only left has row - pad right with null
          alignedLeft.push(leftRowsForKey[i]);
          alignedRight.push(createNullRow(rightAllColumns));
        } else {
          // Only right has row - pad left with null
          alignedLeft.push(createNullRow(leftAllColumns));
          alignedRight.push(rightRowsForKey[i]);
        }
      }
    });

    return { synchronizedLeftRows: alignedLeft, synchronizedRightRows: alignedRight };
  }, [
    leftRows,
    rightRows,
    columnsToCompare,
    createSortKey,
    getAllColumnsFromRows,
    createNullRow,
    leftTableColumns,
    rightTableColumns,
  ]);

  return {
    synchronizedLeftRows,
    synchronizedRightRows,
  };
}

