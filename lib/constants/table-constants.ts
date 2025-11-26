/**
 * Constants for table-related functionality
 */

export const TABLE_LIMIT_OPTIONS = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000] as const;

export const TABLE_COMPARISON_LIMIT_OPTIONS = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000] as const;

export const DEFAULT_TABLE_LIMIT = 100;

export const DEFAULT_TABLE_PAGE = 0;

/**
 * List of column names that should be hidden from table display
 * Add column names here to exclude them from API responses and table views
 */
export const HIDDEN_COLUMNS = [
  'HinhAnh', // Image column - temporarily hidden
  // Add more column names here as needed
] as const;

/**
 * Column name patterns that should be hidden (using endsWith check)
 * These patterns are checked after exact name matching
 */
export const HIDDEN_COLUMN_PATTERNS = [
  '_OriginalId', // Foreign key original ID columns
  // Add more patterns here as needed
] as const;

