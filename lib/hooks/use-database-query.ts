import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import { DEFAULT_TABLE_LIMIT } from '@/lib/constants/table-constants';
import { databaseService } from '@/lib/api/services';
import { databaseKeys } from '@/lib/api/query-keys';
import { API_RETRY_COUNT, QUERY_STALE_TIME, QUERY_CACHE_TIME } from '@/lib/constants';

// Re-export types from service for backward compatibility
export type { ConnectionTestResponse, TablesResponse, TableInfo } from '@/lib/api/services';

/**
 * Query key factory for database queries
 * @deprecated Use databaseKeys from '@/lib/api/query-keys' instead
 * Kept for backward compatibility
 */
export const databaseQueryKeys = {
  all: ['databases'] as const,
  connection: (databaseName?: DatabaseName) => 
    [...databaseQueryKeys.all, 'connection', databaseName] as const,
  tables: (databaseName?: DatabaseName) => 
    [...databaseQueryKeys.all, 'tables', databaseName] as const,
  allConnections: () => [...databaseQueryKeys.all, 'connections'] as const,
  allTables: () => [...databaseQueryKeys.all, 'tables'] as const,
};

/**
 * Helper: Get user config param if user has overridden env config
 * Returns config as string (for service layer) or empty string (for URL)
 * Logic: userConfig || null (if no user config, use env config from API)
 */
async function getUserConfigParam(databaseName: DatabaseName, asString = false): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  try {
    const { getUserDatabaseConfig } = await import('@/lib/utils/db-config-storage');
    const userConfigs = getUserDatabaseConfig();
    const userConfig = userConfigs[databaseName];
    
    if (!userConfig) return '';
    
    // Return as string for service layer, or URL-encoded for direct URL usage
    return asString 
      ? JSON.stringify(userConfig)
      : `&config=${encodeURIComponent(JSON.stringify(userConfig))}`;
  } catch (error) {
    // Ignore errors, fall back to env config
    logger.warn('Error getting user config', error, 'DB_QUERY');
    return '';
  }
}

/**
 * Hook to test database connection
 * Optimized to reduce unnecessary API calls
 */
export function useDatabaseConnection(databaseName?: DatabaseName, enabled: boolean = true) {
  // Get user config hash for queryKey (to invalidate when config changes)
  const [configHash, setConfigHash] = useState<string>('');
  
  useEffect(() => {
    if (typeof window === 'undefined' || !databaseName) return;
    
    const updateConfigHash = async () => {
      try {
        const { getUserDatabaseConfig } = await import('@/lib/utils/db-config-storage');
        const userConfigs = getUserDatabaseConfig();
        const userConfig = userConfigs[databaseName];
        // Create hash from config to detect changes
        const hash = userConfig ? JSON.stringify(userConfig) : 'env';
        setConfigHash(hash);
      } catch {
        setConfigHash('env');
      }
    };
    
    updateConfigHash();
    
    // Listen for storage changes (when user config is updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'db_user_config') {
        updateConfigHash();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [databaseName]);
  
  return useQuery({
    queryKey: [...databaseKeys.connections.detail(databaseName), configHash] as const,
    queryFn: async () => {
      if (!databaseName) {
        throw new Error('Database name is required');
      }
      
      const flowId = logger.startFlow(`API_TEST_CONNECTION_${databaseName.toUpperCase()}`, {
        database: databaseName,
        configHash: configHash.substring(0, 20),
      });
      const flowLog = logger.createFlowLogger(flowId);
      
      try {
        const config = await getUserConfigParam(databaseName, true);
        const response = await databaseService.testConnection(databaseName, config || undefined);
        
        flowLog.success('API call successful', {
          response: {
            success: response.success,
            message: response.message,
            connected: response.data?.connected,
            database: response.data?.database,
            serverInfo: response.data?.serverInfo ? {
              ServerName: response.data.serverInfo.ServerName,
              CurrentDatabase: response.data.serverInfo.CurrentDatabase,
              CurrentUser: response.data.serverInfo.CurrentUser,
            } : undefined,
          },
        });
        
        flowLog.end(true, {
          connected: response.data?.connected,
          database: response.data?.database,
        });
        
        return response;
      } catch (error) {
        flowLog.error('API call failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        flowLog.end(false, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    enabled: enabled && !!databaseName && configHash !== '',
    staleTime: QUERY_STALE_TIME.LONG,
    gcTime: QUERY_CACHE_TIME.MEDIUM,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: API_RETRY_COUNT,
  });
}

/**
 * Hook to get database tables
 */
export function useDatabaseTables(
  databaseName?: DatabaseName,
  enabled: boolean = true,
  includeStats: boolean = true,
  options?: {
    filterText?: string;
    limit?: number;
    page?: number;
  }
) {
  const { filterText = '', limit, page = 0 } = options || {};
  
  return useQuery({
    queryKey: [
      ...databaseKeys.tables.list(databaseName),
      includeStats ? 'with-stats' : 'no-stats',
      filterText,
      limit,
      page,
    ] as const,
    queryFn: async () => {
      if (!databaseName) {
        throw new Error('Database name is required');
      }
      
      const flowId = logger.startFlow(`API_GET_TABLES_${databaseName.toUpperCase()}`, {
        database: databaseName,
        includeStats,
        filterText: filterText || undefined,
        limit,
        page,
      });
      const flowLog = logger.createFlowLogger(flowId);
      
      try {
        const config = await getUserConfigParam(databaseName, true);
        const response = await databaseService.getTables(databaseName, {
          page,
          limit,
          includeStats,
          filterText: filterText || undefined,
          config: config || undefined,
        });
        
        flowLog.success('API call successful', {
          response: {
            success: response.success,
            message: response.message,
            database: response.data?.database,
            tableCount: response.data?.count,
            totalCount: response.data?.totalCount,
            page: response.data?.page,
            limit: response.data?.limit,
            hasStats: includeStats,
            statsCount: includeStats && response.data?.tables 
              ? response.data.tables.filter(t => 
                  t.rowCount !== null && t.rowCount !== undefined &&
                  t.columnCount !== null && t.columnCount !== undefined &&
                  t.relationshipCount !== null && t.relationshipCount !== undefined
                ).length 
              : 0,
          },
        });
        
        flowLog.end(true, {
          tableCount: response.data?.count,
          totalCount: response.data?.totalCount,
          page: response.data?.page,
          limit: response.data?.limit,
        });
        
        return response;
      } catch (error) {
        flowLog.error('API call failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        flowLog.end(false, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    enabled: enabled && !!databaseName,
    staleTime: QUERY_STALE_TIME.MEDIUM,
    gcTime: QUERY_CACHE_TIME.MEDIUM,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: API_RETRY_COUNT,
  });
}

/**
 * Mutation to test database connection
 */
export function useTestConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (databaseName?: DatabaseName) => {
      if (!databaseName) {
        throw new Error('Database name is required');
      }
      
      const config = await getUserConfigParam(databaseName, true);
      return databaseService.testConnection(databaseName, config || undefined);
    },
    onSuccess: (data, databaseName) => {
      if (databaseName) {
        queryClient.invalidateQueries({ 
          queryKey: databaseKeys.connections.detail(databaseName) 
        });
      } else {
        queryClient.invalidateQueries({ 
          queryKey: databaseKeys.connections.all() 
        });
      }
    },
  });
}

/**
 * Mutation to fetch database tables
 */
export function useFetchTables() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (databaseName?: DatabaseName) => {
      if (!databaseName) {
        throw new Error('Database name is required');
      }
      
      const config = await getUserConfigParam(databaseName, true);
      return databaseService.getTables(databaseName, {
        includeStats: true,
        config: config || undefined,
      });
    },
    onSuccess: (data, databaseName) => {
      if (databaseName) {
        queryClient.invalidateQueries({ 
          queryKey: databaseKeys.tables.list(databaseName) 
        });
      } else {
        queryClient.invalidateQueries({ 
          queryKey: databaseKeys.tables.all() 
        });
      }
    },
  });
}

export interface ForeignKeyInfo {
  FK_NAME: string;
  FK_SCHEMA: string;
  FK_TABLE: string;
  FK_COLUMN: string;
  PK_SCHEMA: string;
  PK_TABLE: string;
  PK_COLUMN: string;
}

// Re-export types from service for backward compatibility
export type { TableDataResponse, TableRelationshipsResponse } from '@/lib/api/services';

/**
 * Hook to get table data
 */
export function useTableData(
  databaseName: DatabaseName | undefined,
  schemaName: string | undefined,
  tableName: string | undefined,
  limit: number = DEFAULT_TABLE_LIMIT,
  offset: number = 0,
  enabled: boolean = true,
  includeReferences: boolean = false,
  filters?: Record<string, string>
) {
  const sanitizedFilters =
    filters && typeof filters === "object"
      ? Object.fromEntries(
          Object.entries(filters).filter(
            ([, value]) => typeof value === "string" && value.trim() !== ""
          )
        )
      : undefined;
  const filtersKey =
    sanitizedFilters && Object.keys(sanitizedFilters).length > 0
      ? JSON.stringify(sanitizedFilters)
      : "no-filters";

  return useQuery({
    queryKey: [
      ...databaseKeys.tableData.list(databaseName!, schemaName!, tableName!),
      limit,
      offset,
      includeReferences,
      filtersKey,
    ] as const,
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName, true);
      const response = await databaseService.getTableData(databaseName, schemaName, tableName, {
        limit,
        offset,
        includeReferences,
        filters: sanitizedFilters,
        config: config || undefined,
      });
      
      // Check if response indicates an error
      if (!response.success && response.error) {
        throw new Error(response.error || response.message || 'Failed to load table data');
      }
      
      return response;
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: QUERY_STALE_TIME.LONG, // 5 minutes
    gcTime: QUERY_CACHE_TIME.MEDIUM, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: API_RETRY_COUNT,
  });
}

/**
 * Hook to get table relationships
 */
export function useTableRelationships(
  databaseName: DatabaseName | undefined,
  schemaName: string | undefined,
  tableName: string | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: databaseKeys.tableRelationships.list(
      databaseName!,
      schemaName!,
      tableName!
    ),
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName, true);
      return databaseService.getTableRelationships(databaseName, schemaName, tableName, config || undefined);
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: QUERY_STALE_TIME.LONG, // 5 minutes
    gcTime: QUERY_CACHE_TIME.MEDIUM, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: API_RETRY_COUNT,
  });
}

/**
 * Hook to test if a table is accessible
 */
export function useTestTable(
  databaseName: DatabaseName | undefined,
  schemaName: string | undefined,
  tableName: string | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: [...databaseKeys.tables.all(), 'test', databaseName, schemaName, tableName] as const,
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName, true);
      const response = await databaseService.testTable(databaseName, schemaName, tableName, config || undefined);
      
      // Transform response to match expected format
      // API response already has the correct structure with data.columnsCount
      return {
        success: response.success,
        message: response.message || (response.success ? 'Table is accessible' : response.error || 'Table is not accessible'),
        data: {
          database: response.data?.database || databaseName,
          schema: response.data?.schema || schemaName,
          table: response.data?.table || tableName,
          accessible: response.data?.accessible ?? response.success,
          hasData: response.data?.hasData ?? (response.data?.accessible ?? false),
          columnsCount: response.data?.columnsCount ?? 0,
        },
        error: response.error,
      };
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: QUERY_STALE_TIME.LONG, // 5 minutes
    retry: API_RETRY_COUNT,
  });
}

/**
 * Hook to get table statistics (row count, column count, relationship count)
 */
export function useTableStats(
  databaseName: DatabaseName | undefined,
  schemaName: string | undefined,
  tableName: string | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: databaseKeys.tableStats.list(
      databaseName!,
      schemaName!,
      tableName!
    ),
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      
      const config = await getUserConfigParam(databaseName, true);
      const response = await databaseService.getTableStats(databaseName, schemaName, tableName, config || undefined);
      
      // Transform response to match expected format
      return {
        success: response.success,
        message: response.success ? 'Stats retrieved successfully' : 'Failed to retrieve stats',
        data: {
          database: databaseName,
          schema: schemaName,
          table: tableName,
          rowCount: response.data.rowCount,
          columnCount: response.data.columnCount,
          relationshipCount: response.data.relationshipCount,
        },
      };
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: QUERY_STALE_TIME.MEDIUM, // 30 seconds (stats change less frequently)
    retry: API_RETRY_COUNT,
  });
}

