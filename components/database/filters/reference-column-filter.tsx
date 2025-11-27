import { useState, useMemo, useEffect, useCallback } from "react";
import type { DatabaseName } from "@/lib/db-config";
import { useColumnFilterOptions } from "@/lib/hooks/use-column-filter-options";
import { MultiSelectCombobox } from "./multi-select-combobox";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface ReferenceColumnFilterProps {
  databaseName: DatabaseName | string;
  schemaName: string;
  tableName: string;
  columnName: string;
  includeReferences: boolean;
  showFilters: boolean;
  hasRelationship: boolean;
  filterValue: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function ReferenceColumnFilter({
  databaseName,
  schemaName,
  tableName,
  columnName,
  includeReferences,
  showFilters,
  hasRelationship,
  filterValue,
  onChange,
  onClear,
}: ReferenceColumnFilterProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Cache tất cả options (không có search) để tránh refresh khi filterValue thay đổi
  const [cachedAllOptions, setCachedAllOptions] = useState<string[]>([]);

  // Debounce search term để tránh gọi API quá nhiều
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Load tất cả options khi mở popover lần đầu (không có search)
  const enabledAllOptions =
    showFilters && hasRelationship && includeReferences && hasOpened && !debouncedSearch.trim();

  const { data: allOptionsData, isLoading: isLoadingAll } = useColumnFilterOptions(
    {
      databaseName,
      schemaName,
      tableName,
      columnName,
      includeReferences,
      search: "",
    },
    enabledAllOptions
  );

  // Load filtered options khi có search term
  const enabledSearch =
    showFilters && hasRelationship && includeReferences && hasOpened && debouncedSearch.trim().length > 0;

  const { data: searchData, isLoading: isLoadingSearch } = useColumnFilterOptions(
    {
      databaseName,
      schemaName,
      tableName,
      columnName,
      includeReferences,
      search: debouncedSearch,
    },
    enabledSearch
  );

  // Cache tất cả options khi load lần đầu
  useEffect(() => {
    if (allOptionsData?.data.values && cachedAllOptions.length === 0) {
      setCachedAllOptions(allOptionsData.data.values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOptionsData?.data.values]);

  // Sử dụng search results nếu có search, nếu không thì dùng cached all options
  const options = useMemo(() => {
    if (debouncedSearch.trim()) {
      return searchData?.data.values ?? [];
    }
    if (cachedAllOptions.length > 0) {
      return cachedAllOptions;
    }
    return allOptionsData?.data.values ?? [];
  }, [debouncedSearch, searchData, cachedAllOptions, allOptionsData]);

  const isLoading = debouncedSearch.trim() ? isLoadingSearch : isLoadingAll;

  const handleSearchChange = useCallback((search: string) => {
    setSearchTerm(search);
  }, []);

  return (
    <MultiSelectCombobox
      column={columnName}
      value={filterValue}
      options={options}
      loading={isLoading && cachedAllOptions.length === 0 && !debouncedSearch.trim()}
      placeholder="Filter by FK or display name..."
      onChange={onChange}
      onClear={onClear}
      onSearchChange={handleSearchChange}
      onOpenChange={(open) => {
        if (open && !hasOpened) {
          setHasOpened(true);
        }
        if (!open) {
          setSearchTerm("");
        }
      }}
    />
  );
}

