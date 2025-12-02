"use client";

import { useState, memo } from "react";
import { SingleSelectCombobox } from "../filters/single-select-combobox";
import { useColumnFilterOptions } from "@/lib/hooks/use-column-filter-options";
import { useDebounce } from "@/lib/hooks/use-debounce";
import type { DatabaseName } from "@/lib/db-config";

interface ColumnFilterSelectProps {
  databaseName: DatabaseName;
  schemaName: string;
  tableName: string;
  columnName: string;
  value: string;
  showFilters: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
}

function ColumnFilterSelectComponent({
  databaseName,
  schemaName,
  tableName,
  columnName,
  value,
  showFilters,
  onChange,
  onClear,
}: ColumnFilterSelectProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Load options when opened
  const enabled = showFilters && hasOpened;
  const { data: optionsData, isLoading } = useColumnFilterOptions(
    {
      databaseName,
      schemaName,
      tableName,
      columnName,
      includeReferences: false,
      search: debouncedSearch,
    },
    enabled
  );

  const options = optionsData?.data.values ?? [];

  return (
    <SingleSelectCombobox
      options={options}
      value={value}
      placeholder="Chọn giá trị..."
      loading={isLoading && !debouncedSearch.trim()}
      onChange={(val) => {
        onChange(val);
        setSearchTerm("");
      }}
      onClear={() => {
        onClear();
        setSearchTerm("");
      }}
      onSearchChange={(search) => {
        setSearchTerm(search);
      }}
      onOpenChange={(isOpen) => {
        if (isOpen && !hasOpened) {
          setHasOpened(true);
        }
        if (!isOpen) {
          setSearchTerm("");
        }
      }}
    />
  );
}

// Memoize to prevent unnecessary re-renders
export const ColumnFilterSelect = memo(ColumnFilterSelectComponent);

