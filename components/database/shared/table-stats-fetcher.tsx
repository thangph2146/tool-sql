"use client";

import { useTableStatsFetcher } from '@/lib/hooks';
import type { DatabaseName } from '@/lib/db-config';

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  rowCount?: number | null;
  columnCount?: number | null;
  relationshipCount?: number | null;
}

interface TableStatsFetcherProps {
  databaseName: DatabaseName;
  schema: string;
  table: string;
  status: 'idle' | 'testing' | 'success' | 'error';
  tables: TableInfo[];
  onStatsFetched: (stats: {
    rowCount: number;
    columnCount: number;
    relationshipCount: number;
  }) => void;
}

export function TableStatsFetcher({
  databaseName,
  schema,
  table,
  status,
  tables,
  onStatsFetched,
}: TableStatsFetcherProps) {
  // Check if stats are already available from API response
  const tableFromList = tables.find(
    (t) => t.TABLE_SCHEMA === schema && t.TABLE_NAME === table
  );
  const hasStatsFromApi =
    tableFromList &&
    tableFromList.rowCount !== undefined &&
    tableFromList.rowCount !== null &&
    tableFromList.columnCount !== undefined &&
    tableFromList.columnCount !== null &&
    tableFromList.relationshipCount !== undefined &&
    tableFromList.relationshipCount !== null;

  // Fetch stats when table is successfully tested OR when status is error but we have API stats
  // This allows showing stats from API response even if test failed
  const shouldFetchStats = (status === 'success' || status === 'error') && !hasStatsFromApi;

  useTableStatsFetcher({
    databaseName,
    schema,
    table,
    shouldFetch: shouldFetchStats,
    onStatsFetched,
  });

  return null; // This component doesn't render anything
}

