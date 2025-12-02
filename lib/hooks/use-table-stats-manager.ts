import { useState, useEffect, useCallback } from 'react';
import { useTableStats } from '@/lib/hooks/use-database-query';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';

interface TableStats {
  rowCount: number;
  columnCount: number;
  relationshipCount: number;
}

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  rowCount?: number | null;
  columnCount?: number | null;
  relationshipCount?: number | null;
}

interface UseTableStatsManagerReturn {
  tableStats: Map<string, TableStats>;
  getStats: (schema: string, table: string, tables: TableInfo[]) => TableStats | null;
  setStats: (schema: string, table: string, stats: TableStats) => void;
}

export function useTableStatsManager(databaseName: DatabaseName): UseTableStatsManagerReturn {
  const [tableStats, setTableStats] = useState<Map<string, TableStats>>(new Map());

  const getStats = useCallback(
    (schema: string, table: string, tables: TableInfo[]): TableStats | null => {
      const tableKey = `${schema}.${table}`;
      const tableFromList = tables.find(
        (t) => t.TABLE_SCHEMA === schema && t.TABLE_NAME === table
      );

      // Check if stats are available from API response (allow partial stats)
      // Show stats even if some values are null/undefined
      if (tableFromList) {
        const hasAnyStatsFromApi =
          (tableFromList.rowCount !== undefined && tableFromList.rowCount !== null) ||
          (tableFromList.columnCount !== undefined && tableFromList.columnCount !== null) ||
          (tableFromList.relationshipCount !== undefined && tableFromList.relationshipCount !== null);

        if (hasAnyStatsFromApi) {
          return {
            rowCount: tableFromList.rowCount ?? 0,
            columnCount: tableFromList.columnCount ?? 0,
            relationshipCount: tableFromList.relationshipCount ?? 0,
          };
        }
      }

      // Return fetched stats if available
      return tableStats.get(tableKey) || null;
    },
    [tableStats]
  );

  const setStats = useCallback((schema: string, table: string, stats: TableStats) => {
    const tableKey = `${schema}.${table}`;
    setTableStats((prev) => {
      const existing = prev.get(tableKey);
      if (
        existing &&
        existing.rowCount === stats.rowCount &&
        existing.columnCount === stats.columnCount &&
        existing.relationshipCount === stats.relationshipCount
      ) {
        return prev; // No change, return same reference
      }
      const newMap = new Map(prev);
      newMap.set(tableKey, stats);
      return newMap;
    });
  }, []);

  return { tableStats, getStats, setStats };
}

interface UseTableStatsFetcherProps {
  databaseName: DatabaseName;
  schema: string;
  table: string;
  shouldFetch: boolean;
  onStatsFetched: (stats: TableStats) => void;
}

export function useTableStatsFetcher({
  databaseName,
  schema,
  table,
  shouldFetch,
  onStatsFetched,
}: UseTableStatsFetcherProps) {
  const tableKey = `${schema}.${table}`;
  const { data: statsData, error } = useTableStats(databaseName, schema, table, shouldFetch);

  useEffect(() => {
    if (!shouldFetch) return;

    if (statsData?.success && statsData.data) {
      const newStats = {
        rowCount: statsData.data.rowCount,
        columnCount: statsData.data.columnCount,
        relationshipCount: statsData.data.relationshipCount,
      };

      logger.info(
        'Table stats fetched successfully',
        {
          database: databaseName,
          schema,
          table,
          stats: newStats,
        },
        'TABLE_LIST'
      );

      onStatsFetched(newStats);
    } else if (error) {
      logger.warn(
        'Failed to fetch table stats',
        {
          database: databaseName,
          schema,
          table,
          error,
        },
        'TABLE_LIST'
      );
    }
  }, [shouldFetch, statsData, error, databaseName, schema, table, onStatsFetched]);
}

