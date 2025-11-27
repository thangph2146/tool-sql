import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axios-client';
import type { DatabaseName } from '@/lib/db-config';

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
 * Hook to test database connection
 */
export function useDatabaseConnection(databaseName?: DatabaseName) {
  return useQuery({
    queryKey: databaseQueryKeys.connection(databaseName),
    queryFn: async () => {
      const url = databaseName 
        ? `/api/db/test?database=${databaseName}`
        : '/api/db/test';
      const response = await axiosClient.get<ConnectionTestResponse>(url);
      return response.data;
    },
    enabled: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to get database tables
 */
export function useDatabaseTables(databaseName?: DatabaseName) {
  return useQuery({
    queryKey: databaseQueryKeys.tables(databaseName),
    queryFn: async () => {
      const url = databaseName
        ? `/api/db/tables?database=${databaseName}`
        : '/api/db/tables';
      const response = await axiosClient.get<TablesResponse>(url);
      return response.data;
    },
    enabled: true,
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
  });
}

/**
 * Mutation to test database connection
 */
export function useTestConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (databaseName?: DatabaseName) => {
      const url = databaseName
        ? `/api/db/test?database=${databaseName}`
        : '/api/db/test';
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
      const url = databaseName
        ? `/api/db/tables?database=${databaseName}`
        : '/api/db/tables';
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
  limit: number = 100,
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
      const filtersQuery =
        sanitizedFilters && Object.keys(sanitizedFilters).length > 0
          ? `&filters=${encodeURIComponent(JSON.stringify(sanitizedFilters))}`
          : "";
      const url = `/api/db/table-data?database=${databaseName}&schema=${encodeURIComponent(
        schemaName
      )}&table=${encodeURIComponent(tableName)}&limit=${limit}&offset=${offset}${
        includeReferences ? "&includeReferences=true" : ""
      }${filtersQuery}`;
      const response = await axiosClient.get<TableDataResponse>(url);
      return response.data;
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
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
      const response = await axiosClient.get<TableRelationshipsResponse>(
        `/api/db/table-relationships?database=${databaseName}&schema=${encodeURIComponent(schemaName)}&table=${encodeURIComponent(tableName)}`
      );
      return response.data;
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
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
      const response = await axiosClient.get<TestTableResponse>(
        `/api/db/test-table?database=${databaseName}&schema=${encodeURIComponent(schemaName)}&table=${encodeURIComponent(tableName)}`
      );
      return response.data;
    },
    enabled: enabled && !!databaseName && !!schemaName && !!tableName,
    staleTime: 5 * 60 * 1000, // Consider test result fresh for 5 minutes
    retry: 1, // Only retry once on failure
  });
}

