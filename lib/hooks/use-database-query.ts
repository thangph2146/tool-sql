import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import axiosClient from '@/lib/axios-client';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import { DEFAULT_TABLE_LIMIT } from '@/lib/constants/table-constants';

interface ServerInfo {
  ServerName: string;
  Version: string;
  CurrentDatabase: string;
  CurrentUser: string;
}

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
  rowCount?: number | null;
  columnCount?: number | null;
  relationshipCount?: number | null;
}

interface ConnectionTestResponse {
  success: boolean;
  message: string;
  data: {
    database?: string;
    connected: boolean;
    serverInfo?: ServerInfo;
    connections?: Record<DatabaseName, boolean>;
    serverInfos?: Record<string, ServerInfo>;
  };
  error?: string;
}

interface TablesResponse {
  success: boolean;
  message: string;
  data: {
    database?: string;
    tables?: TableInfo[];
    count?: number;
    totalCount?: number;
    page?: number;
    limit?: number;
    database_1?: { tables: TableInfo[]; success: boolean; error?: string };
    database_2?: { tables: TableInfo[]; success: boolean; error?: string };
  };
}

/**
 * Query key factory for database queries
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
 * Returns config query param string or empty string
 * Logic: userConfig || null (if no user config, use env config from API)
 */
async function getUserConfigParam(databaseName: DatabaseName): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  try {
    const { getUserDatabaseConfig } = await import('@/lib/utils/db-config-storage');
    const userConfigs = getUserDatabaseConfig();
    const userConfig = userConfigs[databaseName];
    
    // Return user config if exists, otherwise use env config (no param needed)
    return userConfig ? `&config=${encodeURIComponent(JSON.stringify(userConfig))}` : '';
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
    queryKey: [...databaseQueryKeys.connection(databaseName), configHash] as const,
    queryFn: async () => {
      const flowId = logger.startFlow(`API_TEST_CONNECTION_${databaseName?.toUpperCase() || 'ALL'}`, {
        database: databaseName,
        configHash: configHash.substring(0, 20), // Log first 20 chars of hash
      });
      const flowLog = logger.createFlowLogger(flowId);
      
      let url = databaseName 
        ? `/api/db/test?database=${databaseName}`
        : '/api/db/test';
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      flowLog.info(`Calling API: ${url}`);
      
      try {
        const response = await axiosClient.get<ConnectionTestResponse>(url);
        
        flowLog.success('API call successful', {
          url,
          response: {
            success: response.data.success,
            message: response.data.message,
            connected: response.data.data?.connected,
            database: response.data.data?.database,
            serverInfo: response.data.data?.serverInfo ? {
              ServerName: response.data.data.serverInfo.ServerName,
              CurrentDatabase: response.data.data.serverInfo.CurrentDatabase,
              CurrentUser: response.data.data.serverInfo.CurrentUser,
            } : undefined,
          },
        });
        
        flowLog.end(true, {
          connected: response.data.data?.connected,
          database: response.data.data?.database,
        });
        
        return response.data;
      } catch (error) {
        flowLog.error('API call failed', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
        flowLog.end(false, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    enabled: enabled && !!databaseName && configHash !== '', // Wait for config hash
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    refetchInterval: false, // Disable automatic refetch - only refetch manually or on mount if stale
    refetchOnMount: true, // Refetch on mount if data is stale
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnReconnect: true, // Refetch when network reconnects
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
      ...databaseQueryKeys.tables(databaseName),
      includeStats ? 'with-stats' : 'no-stats',
      filterText,
      limit,
      page,
    ] as const,
    queryFn: async () => {
      const flowId = logger.startFlow(`API_GET_TABLES_${databaseName?.toUpperCase() || 'ALL'}`, {
        database: databaseName,
        includeStats,
        filterText: filterText || undefined,
        limit,
        page,
      });
      const flowLog = logger.createFlowLogger(flowId);
      
      let url = databaseName
        ? `/api/db/tables?database=${databaseName}`
        : '/api/db/tables';
      
      // Add includeStats parameter if requested
      if (includeStats) {
        url += '&includeStats=true';
      }
      
      // Add filter and pagination parameters
      if (filterText) {
        url += `&filterText=${encodeURIComponent(filterText)}`;
      }
      if (limit !== undefined) {
        url += `&limit=${limit}`;
      }
      if (page !== undefined) {
        url += `&page=${page}`;
      }
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      flowLog.info(`Calling API: ${url}`);
      
      try {
        const response = await axiosClient.get<TablesResponse>(url);
        
        flowLog.success('API call successful', {
          url,
          response: {
            success: response.data.success,
            message: response.data.message,
            database: response.data.data?.database,
            tableCount: response.data.data?.count,
            totalCount: response.data.data?.totalCount,
            page: response.data.data?.page,
            limit: response.data.data?.limit,
            hasStats: includeStats,
            statsCount: includeStats && response.data.data?.tables 
              ? response.data.data.tables.filter(t => 
                  t.rowCount !== null && t.rowCount !== undefined &&
                  t.columnCount !== null && t.columnCount !== undefined &&
                  t.relationshipCount !== null && t.relationshipCount !== undefined
                ).length 
              : 0,
          },
        });
        
        flowLog.end(true, {
          tableCount: response.data.data?.count,
          totalCount: response.data.data?.totalCount,
          page: response.data.data?.page,
          limit: response.data.data?.limit,
        });
        
        return response.data;
      } catch (error) {
        flowLog.error('API call failed', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
        flowLog.end(false, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    enabled: enabled && !!databaseName,
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
    refetchOnMount: false, // Prevent refetch when component remounts
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  });
}

/**
 * Mutation to test database connection
 */
export function useTestConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (databaseName?: DatabaseName) => {
      let url = databaseName
        ? `/api/db/test?database=${databaseName}`
        : '/api/db/test';
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      const response = await axiosClient.get<ConnectionTestResponse>(url);
      return response.data;
    },
    onSuccess: (data, databaseName) => {
      // Invalidate and refetch connection queries
      if (databaseName) {
        queryClient.invalidateQueries({ 
          queryKey: databaseQueryKeys.connection(databaseName) 
        });
      } else {
        queryClient.invalidateQueries({ 
          queryKey: databaseQueryKeys.allConnections() 
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
      let url = databaseName
        ? `/api/db/tables?database=${databaseName}`
        : '/api/db/tables';
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      const response = await axiosClient.get<TablesResponse>(url);
      return response.data;
    },
    onSuccess: (data, databaseName) => {
      // Invalidate and refetch tables queries
      if (databaseName) {
        queryClient.invalidateQueries({ 
          queryKey: databaseQueryKeys.tables(databaseName) 
        });
      } else {
        queryClient.invalidateQueries({ 
          queryKey: databaseQueryKeys.allTables() 
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

interface TableDataResponse {
  success: boolean;
  message: string;
  data: {
    database: DatabaseName;
    schema: string;
    table: string;
    columns: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    hasMore: boolean;
    limit: number;
    offset: number;
    filteredRowCount?: number;
    filtersApplied?: Record<string, string>;
    relationships?: ForeignKeyInfo[];
  };
  error?: string;
}

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
      ...databaseQueryKeys.all,
      "table-data",
      databaseName,
      schemaName,
      tableName,
      limit,
      offset,
      includeReferences,
      filtersKey,
    ] as const,
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      let url = `/api/db/table-data?database=${databaseName}&schema=${encodeURIComponent(
        schemaName
      )}&table=${encodeURIComponent(tableName)}&limit=${limit}&offset=${offset}${
        includeReferences ? "&includeReferences=true" : ""
      }`;
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      const filtersQuery =
        sanitizedFilters && Object.keys(sanitizedFilters).length > 0
          ? `&filters=${encodeURIComponent(JSON.stringify(sanitizedFilters))}`
          : "";
      url += filtersQuery;
      
      try {
        const response = await axiosClient.get<TableDataResponse>(url);
        
        // Check if response indicates an error
        if (!response.data.success && response.data.error) {
          throw new Error(response.data.error || response.data.message || 'Failed to load table data');
        }
        
        return response.data;
      } catch (error) {
        // Log error for debugging
        logger.error('Error in useTableData', {
          url,
          database: databaseName,
          schema: schemaName,
          table: tableName,
          error: error instanceof Error ? error.message : String(error),
        }, 'DB_TABLE_DATA');
        throw error;
      }
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Prevent refetch when component remounts
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    retry: 1, // Only retry once on failure
  });
}

interface TableRelationshipsResponse {
  success: boolean;
  message: string;
  data: {
    database: DatabaseName;
    schema: string;
    table: string;
    relationships: ForeignKeyInfo[];
  };
  error?: string;
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
    queryKey: [...databaseQueryKeys.all, 'table-relationships', databaseName, schemaName, tableName] as const,
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      let url = `/api/db/table-relationships?database=${databaseName}&schema=${encodeURIComponent(schemaName)}&table=${encodeURIComponent(tableName)}`;
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      const response = await axiosClient.get<TableRelationshipsResponse>(url);
      return response.data;
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Prevent refetch when component remounts
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    retry: 1, // Only retry once on failure
  });
}

interface TestTableResponse {
  success: boolean;
  message: string;
  data: {
    database: DatabaseName;
    schema: string;
    table: string;
    accessible: boolean;
    hasData: boolean;
    columnsCount: number;
  };
  error?: string;
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
    queryKey: [...databaseQueryKeys.all, 'test-table', databaseName, schemaName, tableName] as const,
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      let url = `/api/db/test-table?database=${databaseName}&schema=${encodeURIComponent(schemaName)}&table=${encodeURIComponent(tableName)}`;
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      const response = await axiosClient.get<TestTableResponse>(url);
      return response.data;
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: 5 * 60 * 1000, // Consider test result fresh for 5 minutes
    retry: 1, // Only retry once on failure
  });
}

interface TableStatsResponse {
  success: boolean;
  message: string;
  data: {
    database: DatabaseName;
    schema: string;
    table: string;
    rowCount: number;
    columnCount: number;
    relationshipCount: number;
  };
  error?: string;
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
    queryKey: [...databaseQueryKeys.all, 'table-stats', databaseName, schemaName, tableName] as const,
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName) {
        throw new Error('Database, schema, and table are required');
      }
      let url = `/api/db/table-stats?database=${databaseName}&schema=${encodeURIComponent(schemaName)}&table=${encodeURIComponent(tableName)}`;
      
      // Add user config param if user has overridden: userConfig || envConfig
      if (databaseName) {
        url += await getUserConfigParam(databaseName);
      }
      
      const response = await axiosClient.get<TableStatsResponse>(url);
      return response.data;
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: 2 * 60 * 1000, // Consider stats fresh for 2 minutes
    retry: 1, // Only retry once on failure
  });
}

