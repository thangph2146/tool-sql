/**
 * Query Helpers
 * Utility functions for working with TanStack Query
 */

import { QueryClient } from '@tanstack/react-query';
import { databaseKeys } from '@/lib/api/query-keys';
import type { DatabaseName } from '@/lib/db-config';

/**
 * Invalidate all database-related queries
 */
export function invalidateAllDatabaseQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: databaseKeys.all,
  });
}

/**
 * Invalidate queries for a specific database
 */
export function invalidateDatabaseQueries(
  queryClient: QueryClient,
  databaseName: DatabaseName
) {
  queryClient.invalidateQueries({
    queryKey: databaseKeys.all,
    predicate: (query) => {
      const key = query.queryKey;
      return key.includes(databaseName);
    },
  });
}

/**
 * Invalidate table queries for a specific database
 */
export function invalidateTableQueries(
  queryClient: QueryClient,
  databaseName: DatabaseName
) {
  queryClient.invalidateQueries({
    queryKey: databaseKeys.tables.list(databaseName),
  });
}

/**
 * Invalidate table data queries
 */
export function invalidateTableDataQueries(
  queryClient: QueryClient,
  databaseName: DatabaseName,
  schema?: string,
  table?: string
) {
  if (schema && table) {
    queryClient.invalidateQueries({
      queryKey: databaseKeys.tableData.list(databaseName, schema, table),
    });
  } else {
    queryClient.invalidateQueries({
      queryKey: databaseKeys.tableData.all(),
      predicate: (query) => {
        const key = query.queryKey;
        return key.includes(databaseName);
      },
    });
  }
}

/**
 * Prefetch table data
 */
export async function prefetchTableData(
  queryClient: QueryClient,
  databaseName: DatabaseName,
  schema: string,
  table: string,
  options?: {
    limit?: number;
    offset?: number;
    includeReferences?: boolean;
  }
) {
  const { databaseService } = await import('@/lib/api/services');
  const { getUserDatabaseConfig } = await import('@/lib/utils/db-config-storage');
  
  const userConfigs = typeof window !== 'undefined' ? getUserDatabaseConfig() : {};
  const userConfig = userConfigs[databaseName];
  const config = userConfig ? JSON.stringify(userConfig) : undefined;

  await queryClient.prefetchQuery({
    queryKey: databaseKeys.tableData.list(databaseName, schema, table),
    queryFn: () =>
      databaseService.getTableData(databaseName, schema, table, {
        limit: options?.limit,
        offset: options?.offset,
        includeReferences: options?.includeReferences,
        config,
      }),
  });
}

