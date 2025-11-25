import sql from 'mssql';
import * as dbManager from './db-manager';

export type DatabaseName = 'PSC_HRM' | 'HRM_HUB';

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

// Default database for backward compatibility (PSC_HRM)
const DEFAULT_DATABASE: DatabaseName = 'PSC_HRM';

/**
 * Get or create connection pool (uses default database: PSC_HRM)
 * @deprecated Use getConnection('PSC_HRM') or getConnection('HRM_HUB') instead
 */
export async function getDefaultConnection(): Promise<sql.ConnectionPool> {
  return getConnection(DEFAULT_DATABASE);
}

/**
 * Execute query on default database (PSC_HRM)
 * @deprecated Use query('PSC_HRM', queryString, params) or query('HRM_HUB', queryString, params) instead
 */
export async function queryDefault<T = sql.IResult<unknown>>(
  queryString: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  return query(DEFAULT_DATABASE, queryString, params);
}

/**
 * Test default database connection (PSC_HRM)
 * @deprecated Use testConnection('PSC_HRM') or testConnection('HRM_HUB') instead
 */
export async function testDefaultConnection(): Promise<boolean> {
  return testConnection(DEFAULT_DATABASE);
}
