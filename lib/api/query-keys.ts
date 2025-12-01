/**
 * Query Keys Factory
 * Centralized query keys for TanStack Query
 * Ensures consistent key structure across the application
 */

import type { DatabaseName } from '@/lib/db-config';
import { QUERY_KEY_PREFIX } from '@/lib/constants';

/**
 * Database query keys factory
 */
export const databaseKeys = {
  all: [QUERY_KEY_PREFIX.DATABASES] as const,
  
  // Connection queries
  connections: {
    all: () => [...databaseKeys.all, QUERY_KEY_PREFIX.CONNECTIONS] as const,
    detail: (databaseName?: DatabaseName) =>
      [...databaseKeys.connections.all(), databaseName] as const,
  },
  
  // Table queries
  tables: {
    all: () => [...databaseKeys.all, QUERY_KEY_PREFIX.TABLES] as const,
    lists: () => [...databaseKeys.tables.all(), 'list'] as const,
    list: (databaseName?: DatabaseName) =>
      [...databaseKeys.tables.lists(), databaseName] as const,
    detail: (databaseName: DatabaseName, schema: string, table: string) =>
      [...databaseKeys.tables.all(), databaseName, schema, table] as const,
  },
  
  // Table data queries
  tableData: {
    all: () => [...databaseKeys.all, QUERY_KEY_PREFIX.TABLE_DATA] as const,
    lists: () => [...databaseKeys.tableData.all(), 'list'] as const,
    list: (databaseName: DatabaseName, schema: string, table: string) =>
      [...databaseKeys.tableData.lists(), databaseName, schema, table] as const,
  },
  
  // Table relationships queries
  tableRelationships: {
    all: () => [...databaseKeys.all, QUERY_KEY_PREFIX.TABLE_RELATIONSHIPS] as const,
    lists: () => [...databaseKeys.tableRelationships.all(), 'list'] as const,
    list: (databaseName: DatabaseName, schema: string, table: string) =>
      [...databaseKeys.tableRelationships.lists(), databaseName, schema, table] as const,
  },
  
  // Table stats queries
  tableStats: {
    all: () => [...databaseKeys.all, QUERY_KEY_PREFIX.TABLE_STATS] as const,
    lists: () => [...databaseKeys.tableStats.all(), 'list'] as const,
    list: (databaseName: DatabaseName, schema: string, table: string) =>
      [...databaseKeys.tableStats.lists(), databaseName, schema, table] as const,
  },
} as const;

