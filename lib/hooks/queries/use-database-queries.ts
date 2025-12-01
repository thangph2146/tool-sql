/**
 * Custom hooks for database queries using TanStack Query
 * Clean, reusable hooks with proper error handling and caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseKeys } from '@/lib/api/query-keys';
import { databaseService } from '@/lib/api/services';
import type { DatabaseName } from '@/lib/db-config';
import { API_STALE_TIME, API_RETRY_COUNT } from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * Helper: Get user config param if user has overridden env config
 */
async function getUserConfigParam(databaseName: DatabaseName): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  
  try {
    const { getUserDatabaseConfig } = await import('@/lib/utils/db-config-storage');
    const userConfigs = getUserDatabaseConfig();
    const userConfig = userConfigs[databaseName];
    return userConfig ? JSON.stringify(userConfig) : undefined;
  } catch (error) {
    logger.warn('Error getting user config', error, 'DB_QUERY');
    return undefined;
  }
}

/**
 * Hook to test database connection
 */
export function useDatabaseConnection(
  databaseName?: DatabaseName,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: databaseKeys.connections.detail(databaseName),
    queryFn: async () => {
      if (!databaseName) throw new Error('Database name is required');
      
      const config = await getUserConfigParam(databaseName);
      return databaseService.testConnection(databaseName, config);
    },
    enabled: enabled && !!databaseName,
    staleTime: API_STALE_TIME,
    retry: API_RETRY_COUNT,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to test table accessibility
 */
export function useTestTable(
  databaseName?: DatabaseName,
  schema?: string,
  table?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: [...databaseKeys.tables.all(), 'test', databaseName, schema, table],
    queryFn: async () => {
      if (!databaseName || !schema || !table) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName);
      return databaseService.testTable(databaseName, schema, table, config);
    },
    enabled: enabled && !!databaseName && !!schema && !!table,
    staleTime: API_STALE_TIME,
    retry: API_RETRY_COUNT,
  });
}

/**
 * Hook to get tables list
 */
export function useTables(
  databaseName?: DatabaseName,
  options?: {
    page?: number;
    limit?: number;
    includeStats?: boolean;
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey: databaseKeys.tables.list(databaseName),
    queryFn: async () => {
      if (!databaseName) throw new Error('Database name is required');
      
      const config = await getUserConfigParam(databaseName);
      return databaseService.getTables(databaseName, {
        page: options?.page,
        limit: options?.limit,
        includeStats: options?.includeStats,
        config,
      });
    },
    enabled: (options?.enabled ?? true) && !!databaseName,
    staleTime: API_STALE_TIME,
    retry: API_RETRY_COUNT,
  });
}

/**
 * Hook to get table data
 */
export function useTableData(
  databaseName?: DatabaseName,
  schema?: string,
  table?: string,
  options?: {
    limit?: number;
    offset?: number;
    includeReferences?: boolean;
    filters?: Record<string, string>;
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey: databaseKeys.tableData.list(
      databaseName!,
      schema!,
      table!
    ),
    queryFn: async () => {
      if (!databaseName || !schema || !table) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName);
      return databaseService.getTableData(databaseName, schema, table, {
        limit: options?.limit,
        offset: options?.offset,
        includeReferences: options?.includeReferences,
        filters: options?.filters,
        config,
      });
    },
    enabled:
      (options?.enabled ?? true) &&
      !!databaseName &&
      !!schema &&
      !!table,
    staleTime: API_STALE_TIME,
    retry: API_RETRY_COUNT,
  });
}

/**
 * Hook to get table relationships
 */
export function useTableRelationships(
  databaseName?: DatabaseName,
  schema?: string,
  table?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: databaseKeys.tableRelationships.list(
      databaseName!,
      schema!,
      table!
    ),
    queryFn: async () => {
      if (!databaseName || !schema || !table) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName);
      return databaseService.getTableRelationships(databaseName, schema, table, config);
    },
    enabled: enabled && !!databaseName && !!schema && !!table,
    staleTime: API_STALE_TIME * 2, // Relationships change less frequently
    retry: API_RETRY_COUNT,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get table stats
 */
export function useTableStats(
  databaseName?: DatabaseName,
  schema?: string,
  table?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: databaseKeys.tableStats.list(
      databaseName!,
      schema!,
      table!
    ),
    queryFn: async () => {
      if (!databaseName || !schema || !table) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName);
      return databaseService.getTableStats(databaseName, schema, table, config);
    },
    enabled: enabled && !!databaseName && !!schema && !!table,
    staleTime: API_STALE_TIME * 5, // Stats change very infrequently
    retry: API_RETRY_COUNT,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Mutation to test connection
 */
export function useTestConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      databaseName,
      config,
    }: {
      databaseName: DatabaseName;
      config?: string;
    }) => {
      return databaseService.testConnection(databaseName, config);
    },
    onSuccess: (data, variables) => {
      // Invalidate connection query
      queryClient.invalidateQueries({
        queryKey: databaseKeys.connections.detail(variables.databaseName),
      });
    },
  });
}

/**
 * Mutation to fetch tables
 */
export function useFetchTables() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      databaseName,
      options,
    }: {
      databaseName: DatabaseName;
      options?: {
        page?: number;
        limit?: number;
        includeStats?: boolean;
        config?: string;
      };
    }) => {
      return databaseService.getTables(databaseName, options);
    },
    onSuccess: (data, variables) => {
      // Invalidate tables query
      queryClient.invalidateQueries({
        queryKey: databaseKeys.tables.list(variables.databaseName),
      });
    },
  });
}

