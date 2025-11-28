/**
 * Database-related constants
 * Centralized constants for database configuration and operations
 */

// Default timeouts (in milliseconds)
export const DEFAULT_CONNECTION_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

// Default port
export const DEFAULT_DB_PORT = 1433;

// Default boolean values
export const DEFAULT_ENABLED = true;
export const DEFAULT_USE_WINDOWS_AUTH = false;

// Query/API related constants
export const DEFAULT_COLUMN_OPTIONS_LIMIT = 500;
export const MAX_COLUMN_OPTIONS_LIMIT = 2000;
export const MIN_COLUMN_OPTIONS_LIMIT = 1;

// Table data chunking constants
export const MIN_CHUNK_SIZE = 500;
export const MAX_CHUNK_SIZE = 5000;

// Table stats batch processing
export const TABLE_STATS_BATCH_SIZE = 50;

// HTTP status codes
export const HTTP_STATUS_BAD_REQUEST = 400;
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// Refetch intervals (in milliseconds)
export const CONNECTION_REFETCH_INTERVAL = 30000; // 30 seconds

// Valid database names
export const VALID_DATABASES = ['database_1', 'database_2'] as const;

