/**
 * Database API Service
 * Centralized API calls for database operations
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { DatabaseName } from '@/lib/db-config';

// Types
export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  data: {
    database?: string;
    connected: boolean;
    serverInfo?: {
      ServerName: string;
      Version: string;
      CurrentDatabase: string;
      CurrentUser: string;
    };
    connections?: Record<DatabaseName, boolean>;
    serverInfos?: Record<string, unknown>;
  };
  error?: string;
}

export interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
  rowCount?: number | null;
  columnCount?: number | null;
  relationshipCount?: number | null;
}

export interface TablesResponse {
  success: boolean;
  message: string;
  data: {
    database?: string;
    tables?: TableInfo[];
    count?: number;
    totalCount?: number;
    page?: number;
    limit?: number;
  };
}

export interface TableDataResponse {
  success: boolean;
  message?: string;
  data: {
    database: DatabaseName;
    schema: string;
    table: string;
    rows: Record<string, unknown>[];
    columns: string[];
    totalRows: number;
    hasMore: boolean;
    limit: number;
    offset: number;
    filteredRowCount?: number;
    filtersApplied?: Record<string, string>;
    relationships?: Array<{
      FK_NAME: string;
      FK_SCHEMA: string;
      FK_TABLE: string;
      FK_COLUMN: string;
      PK_SCHEMA: string;
      PK_TABLE: string;
      PK_COLUMN: string;
    }>;
    summary?: {
      rowCount: number;
      columnCount: number;
    };
  };
  error?: string;
}

export interface TableRelationshipsResponse {
  success: boolean;
  message?: string;
  data: {
    database: DatabaseName;
    schema: string;
    table: string;
    relationships: Array<{
      FK_NAME: string;
      FK_SCHEMA: string;
      FK_TABLE: string;
      FK_COLUMN: string;
      PK_SCHEMA: string;
      PK_TABLE: string;
      PK_COLUMN: string;
    }>;
  };
  error?: string;
}

/**
 * Database API Service
 */
export const databaseService = {
  /**
   * Test database connection
   */
  testConnection: async (
    databaseName: DatabaseName,
    config?: string
  ): Promise<ConnectionTestResponse> => {
    const params = new URLSearchParams({
      database: databaseName,
      ...(config && { config }),
    });

    const response = await apiClient.get<ConnectionTestResponse>(
      `${API_ENDPOINTS.DB_TEST}?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Test table accessibility
   */
  testTable: async (
    databaseName: DatabaseName,
    schema: string,
    table: string,
    config?: string
  ): Promise<{ success: boolean; accessible: boolean; error?: string }> => {
    const params = new URLSearchParams({
      database: databaseName,
      schema,
      table,
      ...(config && { config }),
    });

    const response = await apiClient.get<{
      success: boolean;
      accessible: boolean;
      error?: string;
    }>(`${API_ENDPOINTS.DB_TEST_TABLE}?${params.toString()}`);
    return response.data;
  },

  /**
   * Get tables list
   */
  getTables: async (
    databaseName: DatabaseName,
    options?: {
      page?: number;
      limit?: number;
      includeStats?: boolean;
      filterText?: string;
      config?: string;
    }
  ): Promise<TablesResponse> => {
    const params = new URLSearchParams({
      database: databaseName,
      ...(options?.page !== undefined && { page: String(options.page) }),
      ...(options?.limit !== undefined && { limit: String(options.limit) }),
      ...(options?.includeStats && { includeStats: 'true' }),
      ...(options?.filterText && { filterText: options.filterText }),
      ...(options?.config && { config: options.config }),
    });

    const response = await apiClient.get<TablesResponse>(
      `${API_ENDPOINTS.DB_TABLES}?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get table data
   */
  getTableData: async (
    databaseName: DatabaseName,
    schema: string,
    table: string,
    options?: {
      limit?: number;
      offset?: number;
      includeReferences?: boolean;
      filters?: Record<string, string>;
      config?: string;
    }
  ): Promise<TableDataResponse> => {
    const params = new URLSearchParams({
      database: databaseName,
      schema,
      table,
      ...(options?.limit !== undefined && { limit: String(options.limit) }),
      ...(options?.offset !== undefined && { offset: String(options.offset) }),
      ...(options?.includeReferences && { includeReferences: 'true' }),
      ...(options?.filters && { filters: JSON.stringify(options.filters) }),
      ...(options?.config && { config: options.config }),
    });

    const response = await apiClient.get<TableDataResponse>(
      `${API_ENDPOINTS.DB_TABLE_DATA}?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get table relationships
   */
  getTableRelationships: async (
    databaseName: DatabaseName,
    schema: string,
    table: string,
    config?: string
  ): Promise<TableRelationshipsResponse> => {
    const params = new URLSearchParams({
      database: databaseName,
      schema,
      table,
      ...(config && { config }),
    });

    const response = await apiClient.get<TableRelationshipsResponse>(
      `${API_ENDPOINTS.DB_TABLE_RELATIONSHIPS}?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get table stats
   */
  getTableStats: async (
    databaseName: DatabaseName,
    schema: string,
    table: string,
    config?: string
  ): Promise<{
    success: boolean;
    data: {
      rowCount: number;
      columnCount: number;
      relationshipCount: number;
    };
  }> => {
    const params = new URLSearchParams({
      database: databaseName,
      schema,
      table,
      ...(config && { config }),
    });

    const response = await apiClient.get<{
      success: boolean;
      data: {
        rowCount: number;
        columnCount: number;
        relationshipCount: number;
      };
    }>(`${API_ENDPOINTS.DB_TABLE_STATS}?${params.toString()}`);
    return response.data;
  },
};

