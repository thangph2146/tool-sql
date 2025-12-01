/**
 * API-related constants
 * Centralized API endpoints and configuration
 */

// API Base URLs
export const API_BASE_URL = typeof window !== 'undefined' 
  ? '' 
  : process.env.NEXT_PUBLIC_API_URL || '';

// API Endpoints
export const API_ENDPOINTS = {
  // Database endpoints
  DB_TEST: '/api/db/test',
  DB_TEST_TABLE: '/api/db/test-table',
  DB_TABLES: '/api/db/tables',
  DB_TABLE_DATA: '/api/db/table-data',
  DB_TABLE_RELATIONSHIPS: '/api/db/table-relationships',
  DB_TABLE_STATS: '/api/db/table-stats',
  DB_COLUMN_OPTIONS: '/api/db/column-options',
  DB_CONFIG: '/api/db/config',
} as const;

// API Request/Response Types
export const API_TIMEOUT = 30000; // 30 seconds
export const API_RETRY_COUNT = 1;
export const API_STALE_TIME = 30 * 1000; // 30 seconds

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Query Keys Prefixes
export const QUERY_KEY_PREFIX = {
  DATABASES: 'databases',
  TABLES: 'tables',
  TABLE_DATA: 'table-data',
  TABLE_RELATIONSHIPS: 'table-relationships',
  TABLE_STATS: 'table-stats',
  CONNECTIONS: 'connections',
} as const;

