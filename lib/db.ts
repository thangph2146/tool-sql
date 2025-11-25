import sql from 'mssql';
import * as dbManager from './db-manager';
import type { DatabaseName } from './db-config';

// Re-export DatabaseName for backward compatibility
export type { DatabaseName } from './db-config';

/**
 * Ensure string is handled as UTF-8/Unicode in SQL Server
 * Add N' prefix for string literals so SQL Server handles as Unicode
 */
export function toUnicodeString(value: string): string {
  // If already has N' prefix, don't add again
  if (value.startsWith("N'") || value.startsWith("N\"")) {
    return value;
  }
  // Return string with N' prefix for Unicode
  return `N'${value.replace(/'/g, "''")}'`;
}

// Re-export from db-manager for backward compatibility
export const getConnection = dbManager.getConnection;
export const closeConnection = dbManager.closeConnection;
export const closeAllConnections = dbManager.closeAllConnections;
export const query = dbManager.query;
export const executeProcedure = dbManager.executeProcedure;
export const testConnection = dbManager.testConnection;
export const testAllConnections = dbManager.testAllConnections;

// Default database for backward compatibility (database_1)
const DEFAULT_DATABASE: DatabaseName = 'database_1';

/**
 * Get or create connection pool (uses default database: database_1)
 * @deprecated Use getConnection('database_1') or getConnection('database_2') instead
 */
export async function getDefaultConnection(): Promise<sql.ConnectionPool> {
  return getConnection(DEFAULT_DATABASE);
}

/**
 * Execute query on default database (database_1)
 * @deprecated Use query('database_1', queryString, params) or query('database_2', queryString, params) instead
 */
export async function queryDefault<T = sql.IResult<unknown>>(
  queryString: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  return query(DEFAULT_DATABASE, queryString, params);
}

/**
 * Test default database connection (database_1)
 * @deprecated Use testConnection('database_1') or testConnection('database_2') instead
 */
export async function testDefaultConnection(): Promise<boolean> {
  return testConnection(DEFAULT_DATABASE);
}
