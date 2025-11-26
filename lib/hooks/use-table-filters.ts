import { useState, useMemo, useCallback } from "react";
import { logger } from "@/lib/logger";
import { useDebounce } from "./use-debounce";

interface UseTableFiltersProps {
  debounceDelay?: number;
}

export interface UseTableFiltersReturn {
  filters: Record<string, string>;
  debouncedFilters: Record<string, string>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  handleFilterChange: (column: string, value: string) => void;
  handleClearFilters: () => void;
  handleClearFilter: (column: string) => void;
}

export function useTableFilters({
  debounceDelay = 300,
}: UseTableFiltersProps = {}): UseTableFiltersReturn {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const debouncedFilters = useDebounce(filters, debounceDelay);
  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((value) => value.trim() !== ""),
    [filters]
  );
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v.trim() !== "").length,
    [filters]
  );

  const handleFilterChange = useCallback((column: string, value: string) => {
    logger.debug(
      `Filter changed for column: ${column}`,
      {
        column,
        value,
        valueLength: value.length,
        isEmpty: value.trim() === "",
      },
      "TABLE_FILTER"
    );
    setFilters((prev) => ({
      ...prev,
      [column]: value,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    const activeFilterCount = Object.values(filters).filter(
      (v) => v.trim() !== ""
    ).length;
    logger.info(
      `Cleared all filters (${activeFilterCount} active filter(s) removed)`,
      {
        clearedFilters: Object.keys(filters).filter(
          (col) => filters[col]?.trim() !== ""
        ),
      },
      "TABLE_FILTER"
    );
    setFilters({});
  }, [filters]);

  const handleClearFilter = useCallback(
    (column: string) => {
      const hadValue = filters[column]?.trim() !== "";
      logger.debug(
        `Cleared filter for column: ${column}`,
        {
          column,
          hadValue,
          previousValue: filters[column] || "",
        },
        "TABLE_FILTER"
      );
      setFilters((prev) => {
        const newFilters = { ...prev };
        delete newFilters[column];
        return newFilters;
      });
    },
    [filters]
  );

  return {
    filters,
    debouncedFilters,
    setFilters,
    showFilters,
    setShowFilters,
    hasActiveFilters,
    activeFilterCount,
    handleFilterChange,
    handleClearFilters,
    handleClearFilter,
  };
}

