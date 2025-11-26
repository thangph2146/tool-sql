import { useState, useMemo } from "react";
import type { DatabaseName } from "@/lib/db-config";
import { useColumnFilterOptions } from "@/lib/hooks/use-column-filter-options";
import { FilterCombobox } from "@/components/database/filter-combobox";

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

  const enabled =
    showFilters && hasRelationship && includeReferences && hasOpened;

  const { data, isLoading } = useColumnFilterOptions(
    {
      databaseName,
      schemaName,
      tableName,
      columnName,
      includeReferences,
    },
    enabled
  );

  const options = useMemo(() => data?.data.values ?? [], [data]);

  return (
    <FilterCombobox
      column={columnName}
      value={filterValue}
      options={options}
      loading={isLoading}
      placeholder="Filter by FK or display name..."
      onChange={onChange}
      onClear={onClear}
      onOpenChange={(open) => {
        if (open && !hasOpened) {
          setHasOpened(true);
        }
      }}
    />
  );
}

