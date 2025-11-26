import { useMemo } from "react";
import { compareAllRows, type ComparisonResult } from "@/lib/utils/table-comparison-utils";

interface UseTableComparisonProps {
  leftRows: Record<string, unknown>[];
  rightRows: Record<string, unknown>[];
  columnsToCompare: string[];
}

/**
 * Custom hook for table comparison logic
 */
export function useTableComparison({
  leftRows,
  rightRows,
  columnsToCompare,
}: UseTableComparisonProps): Map<number, ComparisonResult> | null {
  return useMemo(() => {
    if (!leftRows || !rightRows || leftRows.length === 0 || rightRows.length === 0) {
      return null;
    }

    return compareAllRows(leftRows, rightRows, columnsToCompare);
  }, [leftRows, rightRows, columnsToCompare]);
}

