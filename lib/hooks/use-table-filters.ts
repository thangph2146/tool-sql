import { useState, useMemo, useCallback } from "react";

interface UseTableFiltersProps<T extends Record<string, unknown>> {
  rows: T[];
}

export interface UseTableFiltersReturn<T extends Record<string, unknown>> {
  filters: Record<string, string>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  filteredRows: T[];
  filteredRowCount: number;
  hasActiveFilters: boolean;
  handleFilterChange: (column: string, value: string) => void;
  handleClearFilters: () => void;
  handleClearFilter: (column: string) => void;
}

/**
 * Custom hook for table filtering logic
 */
export function useTableFilters<T extends Record<string, unknown>>({
  rows,
}: UseTableFiltersProps<T>): UseTableFiltersReturn<T> {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Filter rows based on filter values
  const filteredRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const activeFilters = Object.entries(filters).filter(
      ([, value]) => value.trim() !== ""
    );
    if (activeFilters.length === 0) return rows;

    return rows.filter((row) => {
      return activeFilters.every(([column, filterValue]) => {
        const cellValue = row[column];
        if (cellValue === null || cellValue === undefined) {
          return filterValue.toLowerCase() === "null";
        }
        return String(cellValue)
          .toLowerCase()
          .includes(filterValue.toLowerCase());
      });
    });
  }, [rows, filters]);

  // Memoize computed values
  const filteredRowCount = useMemo(() => filteredRows.length, [filteredRows.length]);
  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((value) => value.trim() !== ""),
    [filters]
  );

  // Memoize handlers with useCallback
  const handleFilterChange = useCallback((column: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [column]: value,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleClearFilter = useCallback((column: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
  }, []);

  return {
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    filteredRows,
    filteredRowCount,
    hasActiveFilters,
    handleFilterChange,
    handleClearFilters,
    handleClearFilter,
  };
}

