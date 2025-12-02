/**
 * Custom hook for fetching and processing comparison data
 * Extracted from table-comparison-view.tsx for better modularity
 */

import { useMemo } from 'react';
import { useTableData, useTableRelationships } from '@/lib/hooks/use-database-query';
import { useTableFilters } from '@/lib/hooks/use-table-filters';
import type { DatabaseName } from '@/lib/db-config';
import { sortRelationships } from '@/lib/utils/relationship-utils';
import type { ForeignKeyInfo } from '@/lib/hooks/use-database-query';

interface TableInfo {
  databaseName: DatabaseName;
  schemaName: string;
  tableName: string;
}

interface UseComparisonDataProps {
  leftTable: TableInfo;
  rightTable: TableInfo;
  leftLimit: number;
  rightLimit: number;
  includeReferences: boolean;
  open: boolean;
}

export function useComparisonData({
  leftTable,
  rightTable,
  leftLimit,
  rightLimit,
  includeReferences,
  open,
}: UseComparisonDataProps) {
  // Fetch relationships for both tables
  const leftRelationshipsData = useTableRelationships(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    open
  );

  const rightRelationshipsData = useTableRelationships(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    open
  );

  // Process relationships
  const leftRelationshipsDataValue = leftRelationshipsData?.data?.data?.relationships;
  const rightRelationshipsDataValue = rightRelationshipsData?.data?.data?.relationships;
  
  const leftRelationships = useMemo(() => {
    if (!leftRelationshipsDataValue) return [];
    return sortRelationships(leftRelationshipsDataValue as ForeignKeyInfo[]);
  }, [leftRelationshipsDataValue]);

  const rightRelationships = useMemo(() => {
    if (!rightRelationshipsDataValue) return [];
    return sortRelationships(rightRelationshipsDataValue as ForeignKeyInfo[]);
  }, [rightRelationshipsDataValue]);

  // Filter state hooks
  const leftTableFilters = useTableFilters();
  const rightTableFilters = useTableFilters();

  // Fetch initial data for both tables (offset 0)
  const leftData = useTableData(
    leftTable.databaseName,
    leftTable.schemaName,
    leftTable.tableName,
    leftLimit,
    0,
    open,
    includeReferences,
    leftTableFilters.debouncedFilters
  );

  const rightData = useTableData(
    rightTable.databaseName,
    rightTable.schemaName,
    rightTable.tableName,
    rightLimit,
    0,
    open,
    includeReferences,
    rightTableFilters.debouncedFilters
  );

  // Get totalRows from initial data fetch
  const leftTableData = leftData?.data?.data;
  const rightTableData = rightData?.data?.data;
  const leftTotalRows = leftTableData?.totalRows ?? 0;
  const rightTotalRows = rightTableData?.totalRows ?? 0;

  return {
    // Relationships
    leftRelationships,
    rightRelationships,
    leftRelationshipsData,
    rightRelationshipsData,
    
    // Filters
    leftTableFilters,
    rightTableFilters,
    
    // Data
    leftTableData,
    rightTableData,
    leftTotalRows,
    rightTotalRows,
    
    // Loading states
    leftIsLoading: leftData.isLoading,
    rightIsLoading: rightData.isLoading,
    isLoading: leftData.isLoading || rightData.isLoading,
    
    // Errors
    leftError: leftData.error,
    rightError: rightData.error,
    hasError: !!leftData.error || !!rightData.error,
  };
}

