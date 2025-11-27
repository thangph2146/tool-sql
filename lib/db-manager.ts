import sql from 'mssql';
import { logger } from './logger';
import {
  type DatabaseName,
  getDatabaseConfig,
  getDatabaseConfigSystem,
  validateDatabaseConfig,
  getConfigSummary,
} from './db-config';

// Re-export DatabaseName for backward compatibility
export type { DatabaseName } from './db-config';

/**
 * Escape SQL Server identifier (table name, schema name, column name)
 * Escapes closing brackets by doubling them for use in [bracket] notation
 * Also removes leading/trailing single quotes if present (from URL decoding)
 */
export function escapeSqlIdentifier(identifier: string): string {
  if (!identifier) return identifier;
  
  // Remove leading and trailing single quotes if present (may come from URL decoding)
  let cleaned = identifier.trim();
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || 
      (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Escape closing brackets by doubling them for use in [bracket] notation
  return cleaned.replace(/]/g, ']]');
}

export interface ServerInfo {
  ServerName: string;
  Version: string;
  CurrentDatabase: string;
  CurrentUser: string;
}

interface DatabaseConfig {
  name: DatabaseName;
  pool: sql.ConnectionPool | null;
  config: sql.config;
}

/**
 * Convert DatabaseConfigItem to sql.config format
 */
function convertToSqlConfig(dbConfig: ReturnType<typeof getDatabaseConfig>): sql.config {
  // Split server name and instance name
  const hasInstanceInServer = dbConfig.server.includes('\\');
  let serverName = dbConfig.server;
  let extractedInstanceName: string | undefined;
  
  if (hasInstanceInServer) {
    const parts = dbConfig.server.split('\\');
    serverName = parts[0];
    extractedInstanceName = parts[1];
  }
  
  // Logic: If instance name exists, prioritize using instance name (via SQL Browser)
  // Only use port directly when there's no instance name (default instance)
  const finalInstanceName = dbConfig.instanceName || extractedInstanceName;
  const usePortDirectly = dbConfig.port && !finalInstanceName;

  const baseConfig: sql.config = {
    server: serverName,
    database: dbConfig.database,
    connectionTimeout: dbConfig.connectionTimeout || 30000,
    requestTimeout: dbConfig.requestTimeout || 30000,
    ...(usePortDirectly ? { port: dbConfig.port } : {}),
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      instanceName: (!usePortDirectly && finalInstanceName) ? finalInstanceName : undefined,
    },
  };

  if (usePortDirectly) {
    logger.debug('Using direct port (no instance name)', { 
      server: serverName, 
      port: dbConfig.port,
      database: dbConfig.database
    }, 'DB_CONFIG');
  } else if (finalInstanceName) {
    logger.debug('Using instance name (SQL Browser will find port)', { 
      server: serverName, 
      instanceName: finalInstanceName,
      database: dbConfig.database
    }, 'DB_CONFIG');
  }

  // Windows Authentication
  if (dbConfig.useWindowsAuth) {
    logger.debug('Using Windows Authentication', {
      currentUser: process.env.USERNAME || process.env.USER,
      database: dbConfig.database,
    }, 'DB_CONFIG');
    
    const windowsAuthConfig: sql.config = { 
      ...baseConfig,
    };
    delete (windowsAuthConfig as { user?: string; password?: string; domain?: string }).user;
    delete (windowsAuthConfig as { user?: string; password?: string; domain?: string }).password;
    delete (windowsAuthConfig as { user?: string; password?: string; domain?: string }).domain;
    
    return windowsAuthConfig;
  }

  // SQL Server Authentication
  logger.debug('Using SQL Server Authentication', {
    user: dbConfig.user,
    database: dbConfig.database,
  }, 'DB_CONFIG');
  return {
    ...baseConfig,
    user: dbConfig.user || '',
    password: dbConfig.password || '',
  };
}

// Initialize database connection pools from config system
function initializeDatabases(): Record<DatabaseName, DatabaseConfig> {
  const configSystem = getDatabaseConfigSystem();
  const databases: Record<DatabaseName, DatabaseConfig> = {} as Record<DatabaseName, DatabaseConfig>;

  // Initialize each database from config system
  Object.entries(configSystem.databases).forEach(([name, dbConfig]) => {
    const databaseName = name as DatabaseName;
    
    // Validate configuration
    const validation = validateDatabaseConfig(databaseName);
    if (!validation.valid) {
      logger.warn(`Database ${databaseName} configuration has errors:`, {
        errors: validation.errors,
      }, 'DB_CONFIG');
    }

    // Convert to sql.config format
    const sqlConfig = convertToSqlConfig(dbConfig);
    
    databases[databaseName] = {
      name: databaseName,
      pool: null,
      config: sqlConfig,
    };

    logger.debug(`Database ${databaseName} initialized`, {
      enabled: dbConfig.enabled,
      server: dbConfig.server,
      port: dbConfig.port,
      instanceName: dbConfig.instanceName,
      database: dbConfig.database,
      useWindowsAuth: dbConfig.useWindowsAuth,
      connectionTimeout: dbConfig.connectionTimeout,
      requestTimeout: dbConfig.requestTimeout,
    }, 'DB_CONFIG');
  });

  // Log configuration summary
  logger.info('Database configuration system initialized', getConfigSummary(), 'DB_CONFIG');

  return databases;
}

// Database connection pools
const databases = initializeDatabases();

// Locks to prevent race conditions when creating connection pools
const poolCreationLocks: Record<DatabaseName, Promise<sql.ConnectionPool> | null> = {
  database_1: null,
  database_2: null,
};

/**
 * Get or create connection pool for a specific database
 * Each database has its own separate connection pool
 */
export async function getConnection(databaseName: DatabaseName): Promise<sql.ConnectionPool> {
  // Check if database is enabled
  const dbConfig = getDatabaseConfig(databaseName);
  if (!dbConfig.enabled) {
    throw new Error(`Database ${databaseName} is disabled in configuration`);
  }

  const db = databases[databaseName];
  
  if (!db) {
    throw new Error(`Database ${databaseName} not found in configuration`);
  }
  
  // If pool already exists and is connected, return it
  if (db.pool && db.pool.connected) {
    // Double-check the pool is for the correct database
    try {
      const verifyResult = await db.pool.request().query('SELECT DB_NAME() as CurrentDatabase');
      const actualDatabase = verifyResult.recordset[0]?.CurrentDatabase;
      const expectedDatabase = db.config.database;
      if (actualDatabase && actualDatabase !== expectedDatabase) {
        logger.error(`CRITICAL: Connection pool database mismatch! Expected ${expectedDatabase}, got ${actualDatabase}. Recreating pool...`, {
          expected: expectedDatabase,
          actual: actualDatabase,
          databaseName,
        }, 'DB_CONNECTION');
        // Close and recreate the pool
        await db.pool.close();
        db.pool = null;
        poolCreationLocks[databaseName] = null;
      } else {
        return db.pool;
      }
    } catch (verifyError) {
      // If verification fails, the pool might be dead, recreate it
      logger.warn(`Connection pool verification failed for ${databaseName}, recreating...`, {
        error: verifyError,
      }, 'DB_CONNECTION');
      db.pool = null;
      poolCreationLocks[databaseName] = null;
    }
  }
  
  // If there's already a pool creation in progress, wait for it
  if (poolCreationLocks[databaseName]) {
    return poolCreationLocks[databaseName]!;
  }
  
  // Create a new pool creation promise
  if (!db.pool) {
    const startTime = Date.now();
    logger.logConnectionState('connecting', {
      server: db.config.server,
      database: db.config.database,
    });

    // Create pool creation promise
    poolCreationLocks[databaseName] = (async () => {
      try {
        // Create a new connection pool specifically for this database
        // Use ConnectionPool constructor directly to ensure each database has its own pool
        // sql.connect() may reuse pools based on connection string, so we use new ConnectionPool() instead
        db.pool = new sql.ConnectionPool(db.config);
        await db.pool.connect();
        const duration = Date.now() - startTime;
        
        // Verify the connection is to the correct database
        const verifyResult = await db.pool.request().query('SELECT DB_NAME() as CurrentDatabase');
        const actualDatabase = verifyResult.recordset[0]?.CurrentDatabase;
        const expectedDatabase = db.config.database; // Use actual database name from config
        
        if (actualDatabase && actualDatabase !== expectedDatabase) {
          logger.error(`CRITICAL: Database mismatch in connection pool! Expected ${expectedDatabase}, got ${actualDatabase}. Closing pool...`, {
            expected: expectedDatabase,
            actual: actualDatabase,
            databaseName, // System key (database_1 or database_2)
          }, 'DB_CONNECTION');
          await db.pool.close();
          db.pool = null;
          poolCreationLocks[databaseName] = null;
          throw new Error(`Database mismatch: Expected ${expectedDatabase}, got ${actualDatabase}`);
        }
        
        logger.logConnectionState('connected', {
          server: db.config.server,
          database: db.config.database,
          duration,
        });
        
        logger.debug(`Connection verified: Connected to correct database ${expectedDatabase}`, {
          database: expectedDatabase,
          databaseName, // System key (database_1 or database_2)
        }, 'DB_CONNECTION');
        
        // Clear the lock
        poolCreationLocks[databaseName] = null;
        return db.pool;
      } catch (error) {
        // Clear the lock on error
        poolCreationLocks[databaseName] = null;
        db.pool = null;
        logger.logConnectionState('error', {
          server: db.config.server,
          database: db.config.database,
          error,
        });
        throw error;
      }
    })();
    
    return poolCreationLocks[databaseName]!;
  }
  
  // If we reach here, pool should exist
  if (!db.pool) {
    throw new Error(`Failed to create connection pool for ${databaseName}`);
  }
  
  return db.pool;
}

/**
 * Close connection for a specific database
 */
export async function closeConnection(databaseName: DatabaseName): Promise<void> {
  const db = databases[databaseName];
  if (db.pool) {
    await db.pool.close();
    logger.logConnectionState('disconnected', {
      server: db.config.server,
      database: db.config.database,
    });
    db.pool = null;
  }
}

/**
 * Close all database connections
 */
export async function closeAllConnections(): Promise<void> {
  const configSystem = getDatabaseConfigSystem();
  const enabledDatabases = Object.keys(configSystem.databases).filter(
    (name) => configSystem.databases[name as DatabaseName].enabled
  ) as DatabaseName[];

  await Promise.all(
    enabledDatabases.map((dbName) => closeConnection(dbName))
  );
}

/**
 * Execute query on a specific database
 * Ensures the query runs on the correct database by using the database-specific connection pool
 */
export async function query<T = sql.IResult<unknown>>(
  databaseName: DatabaseName,
  queryString: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  const startTime = Date.now();
  
  // Get the connection pool for this specific database
  const connection = await getConnection(databaseName);
  const request = connection.request();

  // Add parameters if provided
  if (params) {
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });
  }

  try {
    // Verify we're on the correct database before executing query
    const dbCheck = await connection.request().query('SELECT DB_NAME() as CurrentDatabase');
    const currentDb = dbCheck.recordset[0]?.CurrentDatabase;
    const db = databases[databaseName];
    const expectedDatabase = db.config.database; // Use actual database name from config
    
    if (currentDb && currentDb !== expectedDatabase) {
      logger.error(`Query attempted on wrong database! Expected ${expectedDatabase}, but connection is to ${currentDb}`, {
        expected: expectedDatabase,
        actual: currentDb,
        databaseName, // System key (database_1 or database_2)
        query: queryString.substring(0, 100),
      }, 'DB_QUERY');
      throw new Error(`Database mismatch: Expected ${expectedDatabase}, but connection is to ${currentDb}`);
    }
    
    const result = await request.query<T>(queryString);
    const duration = Date.now() - startTime;
    logger.logQuery(queryString, params, duration, databaseName);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query execution error', { 
      database: databaseName,
      query: queryString, 
      params, 
      duration, 
      error 
    }, 'DB_QUERY');
    throw error;
  }
}

/**
 * Execute stored procedure on a specific database
 */
export async function executeProcedure<T = sql.IResult<unknown>>(
  databaseName: DatabaseName,
  procedureName: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  const startTime = Date.now();
  const connection = await getConnection(databaseName);
  const request = connection.request();

  // Add parameters if provided
  if (params) {
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });
  }

  try {
    const result = await request.execute<T>(procedureName);
    const duration = Date.now() - startTime;
    logger.debug(`Executing stored procedure: ${procedureName}`, { 
      database: databaseName,
      params, 
      duration 
    }, 'DB_PROCEDURE');
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Stored procedure execution error', { 
      database: databaseName,
      procedure: procedureName, 
      params, 
      duration, 
      error 
    }, 'DB_PROCEDURE');
    throw error;
  }
}

/**
 * Test connection to a specific database
 */
export async function testConnection(databaseName: DatabaseName, flowId?: string): Promise<boolean> {
  const flowLog = flowId ? logger.createFlowLogger(flowId) : null;
  
  try {
    const logData = {
      server: databases[databaseName].config.server,
      database: databases[databaseName].config.database,
    };
    
    if (flowLog) {
      flowLog.info(`Testing connection to database: ${databaseName}`, logData);
    } else {
      logger.info(`Testing connection to database: ${databaseName}...`, logData, 'DB_TEST');
    }
    
    const result = await query(databaseName, 'SELECT 1 as test');
    const isConnected = result.recordset.length > 0;
    
    if (isConnected) {
      if (flowLog) {
        flowLog.success(`Connection test successful`);
      } else {
        logger.success(`Connection test successful for database: ${databaseName}`, logData, 'DB_TEST');
      }
    } else {
      if (flowLog) {
        flowLog.warn(`Connection test returned no results`);
      } else {
        logger.warn(`Connection test returned no results for database: ${databaseName}`, logData, 'DB_TEST');
      }
    }
    return isConnected;
  } catch (error) {
    const logData = {
      error,
      server: databases[databaseName].config.server,
      database: databases[databaseName].config.database,
    };
    
    if (flowLog) {
      flowLog.error(`Connection test error`, error);
    } else {
      logger.error(`Connection test error for database: ${databaseName}`, logData, 'DB_TEST');
    }
    return false;
  }
}

/**
 * Test all database connections
 * Only tests enabled databases
 */
export async function testAllConnections(): Promise<Record<DatabaseName, boolean>> {
  const configSystem = getDatabaseConfigSystem();
  const enabledDatabases = Object.entries(configSystem.databases)
    .filter(([, config]) => config.enabled)
    .map(([name]) => name as DatabaseName);

  if (enabledDatabases.length === 0) {
    logger.warn('No enabled databases found to test', undefined, 'DB_TEST');
    return {
      database_1: false,
      database_2: false,
    };
  }

  const results = await Promise.all(
    enabledDatabases.map(dbName =>
      testConnection(dbName).then(result => ({ name: dbName, connected: result }))
    )
  );

  // Initialize result map with all possible databases
  const resultMap: Record<DatabaseName, boolean> = {
    database_1: false,
    database_2: false,
  };

  // Set results for enabled databases
  results.forEach(({ name, connected }) => {
    resultMap[name] = connected;
  });

  return resultMap;
}

/**
 * Table information interface
 */
export interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
  ROW_COUNT?: number;
}

/**
 * Get list of tables from a specific database
 * This function queries tables only from the specified database since the connection
 * is established with that specific database in the config.
 * INFORMATION_SCHEMA.TABLES automatically returns tables only from the current database context.
 */
export async function getTables(databaseName: DatabaseName, flowId?: string): Promise<TableInfo[]> {
  const flowLog = flowId ? logger.createFlowLogger(flowId) : null;
  
  try {
    if (flowLog) {
      flowLog.info(`Querying INFORMATION_SCHEMA.TABLES`);
    } else {
      logger.info(`Fetching tables from database: ${databaseName}...`, {
        database: databaseName,
      }, 'DB_TABLES');
    }

    // Query tables from the current database context
    // Since we connect to a specific database via getConnection(databaseName),
    // INFORMATION_SCHEMA.TABLES will only return tables from that database
    const result = await query<TableInfo & { CURRENT_DB: string }>(databaseName, `
      SELECT 
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        t.TABLE_TYPE,
        DB_NAME() as CURRENT_DB
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
    `);

    const tables = result.recordset;
    
    // Verify that tables are from the correct database
    if (tables.length > 0) {
      const currentDb = tables[0].CURRENT_DB;
      const db = databases[databaseName];
      const expectedDatabase = db.config.database; // Use actual database name from config
      if (currentDb && currentDb !== expectedDatabase) {
        if (flowLog) {
          flowLog.warn(`Database context mismatch: Expected ${expectedDatabase}, got ${currentDb}`);
        } else {
          logger.warn(`Database context mismatch detected. Expected ${expectedDatabase}, got ${currentDb}`, {
            expected: expectedDatabase,
            actual: currentDb,
            databaseName, // System key (database_1 or database_2)
          }, 'DB_TABLES');
        }
      }
    }
    
    // Remove CURRENT_DB from result before returning
    const cleanedTables: TableInfo[] = tables.map((table) => ({
      TABLE_SCHEMA: table.TABLE_SCHEMA,
      TABLE_NAME: table.TABLE_NAME,
      TABLE_TYPE: table.TABLE_TYPE,
    }));
    
    if (flowLog) {
      flowLog.success(`Fetched ${cleanedTables.length} tables`);
    } else {
      logger.success(`Successfully fetched ${cleanedTables.length} tables from database: ${databaseName}`, {
        database: databaseName,
        tableCount: cleanedTables.length,
      }, 'DB_TABLES');
    }

    return cleanedTables;
  } catch (error) {
    if (flowLog) {
      flowLog.error(`Error fetching tables`, error);
    } else {
      logger.error(`Error fetching tables from database: ${databaseName}`, {
        error,
        database: databaseName,
      }, 'DB_TABLES');
    }
    throw error;
  }
}

/**
 * Get table row count (optional, can be slow for large tables)
 */
export async function getTableRowCount(
  databaseName: DatabaseName,
  schemaName: string,
  tableName: string
): Promise<number> {
  try {
    // Escape schema and table names for SQL Server
    const escapedSchema = escapeSqlIdentifier(schemaName);
    const escapedTable = escapeSqlIdentifier(tableName);
    
    const result = await query<{ row_count: number }>(databaseName, `
      SELECT COUNT(*) as row_count
      FROM [${escapedSchema}].[${escapedTable}]
    `);
    return result.recordset[0]?.row_count || 0;
  } catch (error) {
    logger.error(`Error getting row count for table: ${schemaName}.${tableName}`, {
      error,
      database: databaseName,
      schema: schemaName,
      table: tableName,
    }, 'DB_TABLES');
    return 0;
  }
}

/**
 * Get table data with pagination
 * Returns data from a specific table with limit and offset for pagination
 */
export async function getTableData(
  databaseName: DatabaseName,
  schemaName: string,
  tableName: string,
  limit: number = 100,
  offset: number = 0,
  flowId?: string
): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  hasMore: boolean;
}> {
  const flowLog = flowId ? logger.createFlowLogger(flowId) : null;
  
  try {
    if (flowLog) {
      flowLog.info(`Getting total row count`);
    } else {
      logger.info(`Fetching data from table: ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        limit,
        offset,
      }, 'DB_TABLE_DATA');
    }

    // Escape schema and table names for SQL Server
    const escapedSchema = escapeSqlIdentifier(schemaName);
    const escapedTable = escapeSqlIdentifier(tableName);

    // Get total row count
    const countResult = await query<{ total: number }>(databaseName, `
      SELECT COUNT(*) as total
      FROM [${escapedSchema}].[${escapedTable}]
    `);
    const totalRows = countResult.recordset[0]?.total || 0;

    if (flowLog) {
      flowLog.info(`Total rows: ${totalRows}, fetching data with pagination (limit: ${limit}, offset: ${offset})`);
    }

    // Get table data with pagination
    const dataResult = await query(databaseName, `
      SELECT TOP ${limit} *
      FROM (
        SELECT *, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) as rn
        FROM [${escapedSchema}].[${escapedTable}]
      ) AS t
      WHERE t.rn > ${offset}
      ORDER BY t.rn
    `);

    // Get rows and remove ROW_NUMBER column
    const rows = Array.from(dataResult.recordset).map((row: unknown) => {
      const rowObj = row as Record<string, unknown>;
      // Remove ROW_NUMBER column from result
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { rn: _rn, ...rest } = rowObj;
      return rest;
    });

    // Get column names from first row (excluding 'rn')
    const columns = rows.length > 0 
      ? Object.keys(rows[0])
      : [];

    const hasMore = offset + rows.length < totalRows;

    if (flowLog) {
      flowLog.success(`Fetched ${rows.length} rows (${columns.length} columns)`);
    } else {
      logger.success(`Successfully fetched ${rows.length} rows from ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        rowsReturned: rows.length,
        totalRows,
        hasMore,
      }, 'DB_TABLE_DATA');
    }

    return {
      columns,
      rows,
      totalRows,
      hasMore,
    };
  } catch (error) {
    if (flowLog) {
      flowLog.error(`Error fetching table data`, error);
    } else {
      logger.error(`Error fetching data from table: ${schemaName}.${tableName}`, {
        error,
        database: databaseName,
        schema: schemaName,
        table: tableName,
      }, 'DB_TABLE_DATA');
    }
    throw error;
  }
}

/**
 * Foreign key relationship information
 */
export interface ForeignKeyInfo {
  FK_NAME: string;
  FK_SCHEMA: string;
  FK_TABLE: string;
  FK_COLUMN: string;
  PK_SCHEMA: string;
  PK_TABLE: string;
  PK_COLUMN: string;
}

/**
 * Get foreign key relationships for a specific table
 */
export async function getTableForeignKeys(
  databaseName: DatabaseName,
  schemaName: string,
  tableName: string,
  flowId?: string
): Promise<ForeignKeyInfo[]> {
  const flowLog = flowId ? logger.createFlowLogger(flowId) : null;
  
  try {
    if (flowLog) {
      flowLog.info(`Querying sys.foreign_keys for ${schemaName}.${tableName}`);
    } else {
      logger.info(`Fetching foreign keys for table: ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
      }, 'DB_FOREIGN_KEYS');
    }

    // Escape schema and table names for SQL injection prevention
    const escapedSchema = escapeSqlIdentifier(schemaName).replace(/'/g, "''");
    const escapedTable = escapeSqlIdentifier(tableName).replace(/'/g, "''");
    
    const result = await query<ForeignKeyInfo>(databaseName, `
      SELECT 
        fk.name AS FK_NAME,
        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS FK_SCHEMA,
        OBJECT_NAME(fk.parent_object_id) AS FK_TABLE,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS FK_COLUMN,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS PK_SCHEMA,
        OBJECT_NAME(fk.referenced_object_id) AS PK_TABLE,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS PK_COLUMN
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fkc 
        ON fk.object_id = fkc.constraint_object_id
      WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = N'${escapedSchema}'
        AND OBJECT_NAME(fk.parent_object_id) = N'${escapedTable}'
      ORDER BY fk.name, fkc.constraint_column_id
    `);

    const foreignKeys = result.recordset;

    if (flowLog) {
      flowLog.success(`Fetched ${foreignKeys.length} foreign keys`);
    } else {
      logger.success(`Successfully fetched ${foreignKeys.length} foreign keys for ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        foreignKeyCount: foreignKeys.length,
      }, 'DB_FOREIGN_KEYS');
    }

    return foreignKeys;
  } catch (error) {
    if (flowLog) {
      flowLog.error(`Error fetching foreign keys`, error);
    } else {
      logger.error(`Error fetching foreign keys for table: ${schemaName}.${tableName}`, {
        error,
        database: databaseName,
        schema: schemaName,
        table: tableName,
      }, 'DB_FOREIGN_KEYS');
    }
    throw error;
  }
}

/**
 * Get foreign keys that reference the current table (incoming relationships)
 * Returns relationships where other tables have FK pointing to this table's PK
 */
export async function getTableReferencedBy(
  databaseName: DatabaseName,
  schemaName: string,
  tableName: string,
  flowId?: string
): Promise<ForeignKeyInfo[]> {
  const flowLog = flowId ? logger.createFlowLogger(flowId) : null;
  
  try {
    if (flowLog) {
      flowLog.info(`Querying sys.foreign_keys for tables referencing ${schemaName}.${tableName}`);
    } else {
      logger.info(`Fetching incoming foreign keys for table: ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
      }, 'DB_FOREIGN_KEYS_INCOMING');
    }

    // Escape schema and table names for SQL injection prevention
    const escapedSchema = escapeSqlIdentifier(schemaName).replace(/'/g, "''");
    const escapedTable = escapeSqlIdentifier(tableName).replace(/'/g, "''");
    
    const result = await query<ForeignKeyInfo>(databaseName, `
      SELECT 
        fk.name AS FK_NAME,
        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS FK_SCHEMA,
        OBJECT_NAME(fk.parent_object_id) AS FK_TABLE,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS FK_COLUMN,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS PK_SCHEMA,
        OBJECT_NAME(fk.referenced_object_id) AS PK_TABLE,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS PK_COLUMN
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fkc 
        ON fk.object_id = fkc.constraint_object_id
      WHERE OBJECT_SCHEMA_NAME(fk.referenced_object_id) = N'${escapedSchema}'
        AND OBJECT_NAME(fk.referenced_object_id) = N'${escapedTable}'
      ORDER BY fk.name, fkc.constraint_column_id
    `);

    const foreignKeys = result.recordset;

    if (flowLog) {
      flowLog.success(`Fetched ${foreignKeys.length} incoming foreign keys`);
    } else {
      logger.success(`Successfully fetched ${foreignKeys.length} incoming foreign keys for ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        foreignKeyCount: foreignKeys.length,
      }, 'DB_FOREIGN_KEYS_INCOMING');
    }

    return foreignKeys;
  } catch (error) {
    if (flowLog) {
      flowLog.error(`Error fetching incoming foreign keys`, error);
    } else {
      logger.error(`Error fetching incoming foreign keys for table: ${schemaName}.${tableName}`, {
        error,
        database: databaseName,
        schema: schemaName,
        table: tableName,
      }, 'DB_FOREIGN_KEYS_INCOMING');
    }
    throw error;
  }
}

/**
 * Find columns for full name (Ho + Ten) in a referenced table
 * Returns SQL expression to concatenate Ho and Ten columns
 */
async function findFullNameExpression(
  databaseName: DatabaseName,
  schemaName: string,
  tableName: string,
  alias: string,
  excludeColumn: string
): Promise<string | null> {
  try {
    // Escape schema, table, and column names for SQL injection prevention
    const escapedSchema = escapeSqlIdentifier(schemaName).replace(/'/g, "''");
    const escapedTable = escapeSqlIdentifier(tableName).replace(/'/g, "''");
    const escapedExcludeColumn = escapeSqlIdentifier(excludeColumn).replace(/'/g, "''");
    
    // Get all columns from the referenced table
    const columnsResult = await query<{ COLUMN_NAME: string }>(databaseName, `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = N'${escapedSchema}'
        AND TABLE_NAME = N'${escapedTable}'
        AND COLUMN_NAME != N'${escapedExcludeColumn}'
      ORDER BY ORDINAL_POSITION
    `);

    const columns = columnsResult.recordset.map(r => r.COLUMN_NAME);
    const lowerColumns = columns.map(c => c.toLowerCase());

    // Look for Ho (Last name) and Ten (First name) columns
    // Support both Vietnamese and English column names
    const hoPatterns = [
      'ho', 'họ', 'lastname', 'surname', 'familyname', 
      'holot', 'họ lót', 'holoten', 'họ và tên'
    ];
    const tenPatterns = [
      'ten', 'tên', 'firstname', 'givenname', 'forename',
      'hoten', 'họ tên', 'holoten', 'họ và tên'
    ];
    
    let hoColumn: string | null = null;
    let tenColumn: string | null = null;

    // Find Ho column - check exact match first, then contains
    for (const pattern of hoPatterns) {
      const patternLower = pattern.toLowerCase();
      // Try exact match first
      const exactMatch = columns.find((col, idx) => 
        lowerColumns[idx] === patternLower
      );
      if (exactMatch) {
        hoColumn = exactMatch;
        break;
      }
      // Then try contains
      const containsMatch = columns.find((col, idx) => 
        lowerColumns[idx].includes(patternLower) && 
        !lowerColumns[idx].includes('ten') && // Exclude columns that contain both ho and ten
        !lowerColumns[idx].includes('tên')
      );
      if (containsMatch) {
        hoColumn = containsMatch;
        break;
      }
    }

    // Find Ten column - check exact match first, then contains
    for (const pattern of tenPatterns) {
      const patternLower = pattern.toLowerCase();
      // Try exact match first
      const exactMatch = columns.find((col, idx) => 
        lowerColumns[idx] === patternLower
      );
      if (exactMatch) {
        tenColumn = exactMatch;
        break;
      }
      // Then try contains, but exclude columns that are "Ho" or "Họ"
      const containsMatch = columns.find((col, idx) => 
        lowerColumns[idx].includes(patternLower) && 
        !lowerColumns[idx].includes('ho') && 
        !lowerColumns[idx].includes('họ')
      );
      if (containsMatch) {
        tenColumn = containsMatch;
        break;
      }
    }
    
    // Special case: if there's a column "Họ và Tên" or "HoTen", use it directly
    const fullNameColumn = columns.find((col, idx) => {
      const lower = lowerColumns[idx];
      return lower === 'họ và tên' || 
             lower === 'họ và tên' ||
             lower === 'holoten' ||
             lower === 'hoten' ||
             lower.includes('họ và tên') ||
             lower.includes('holoten');
    });
    
    if (fullNameColumn && !hoColumn && !tenColumn) {
      const escapedFullName = fullNameColumn.replace(/]/g, ']]');
      return `${alias}.[${escapedFullName}]`;
    }

    // If both found, concatenate them
    if (hoColumn && tenColumn) {
      const escapedHo = hoColumn.replace(/]/g, ']]');
      const escapedTen = tenColumn.replace(/]/g, ']]');
      // Use LTRIM and RTRIM to handle NULL values and spaces
      return `LTRIM(RTRIM(ISNULL(${alias}.[${escapedHo}], '') + ' ' + ISNULL(${alias}.[${escapedTen}], '')))`;
    }

    // If only one found, return it
    if (hoColumn) {
      const escapedHo = hoColumn.replace(/]/g, ']]');
      return `${alias}.[${escapedHo}]`;
    }
    
    if (tenColumn) {
      const escapedTen = tenColumn.replace(/]/g, ']]');
      return `${alias}.[${escapedTen}]`;
    }

    return null;
  } catch (error) {
    logger.warn(`Error finding full name columns for ${schemaName}.${tableName}`, {
      error,
      database: databaseName,
      schema: schemaName,
      table: tableName,
    }, 'DB_FIND_FULL_NAME');
    return null;
  }
}

/**
 * Find a suitable display column in a referenced table
 * Looks for common column names like Name, Title, Ten, MoTa, etc.
 * For Oid and similar FK columns, tries to find full name (Ho + Ten)
 */
async function findDisplayColumn(
  databaseName: DatabaseName,
  schemaName: string,
  tableName: string,
  excludeColumn: string,
  fkColumnName?: string
): Promise<{ expression: string; isFullName: boolean }> {
  try {
    // Check if this is an Oid or similar user/person reference
    // Check exact match first, then contains
    const fkLower = fkColumnName?.toLowerCase() || '';
    const isPersonReference = fkColumnName && (
      fkLower === 'oid' ||
      fkLower.includes('oid') ||
      fkLower === 'userid' ||
      fkLower.includes('userid') ||
      fkLower === 'nhanvienid' ||
      fkLower.includes('nhanvienid') ||
      fkLower === 'personid' ||
      fkLower.includes('personid') ||
      fkLower === 'nguoidungid' ||
      fkLower.includes('nguoidungid') ||
      fkLower === 'nhanvien' ||
      fkLower.includes('nhanvien')
    );

    // If it's a person reference, try to find full name first
    if (isPersonReference) {
      // We'll need the alias later, so we'll handle this in the calling function
      // For now, return a flag that we need full name
      return { expression: '', isFullName: true };
    }

    // Common display column name patterns (priority order)
    const displayPatterns = [
      'Name', 'Ten', 'Title', 'TieuDe',
      'MoTa', 'Description', 'GhiChu',
      'Code', 'Ma', 'MaSo',
    ];

    // Escape schema, table, and column names for SQL injection prevention
    const escapedSchema = escapeSqlIdentifier(schemaName).replace(/'/g, "''");
    const escapedTable = escapeSqlIdentifier(tableName).replace(/'/g, "''");
    const escapedExcludeColumn = escapeSqlIdentifier(excludeColumn).replace(/'/g, "''");
    
    // Get all columns from the referenced table
    const columnsResult = await query<{ COLUMN_NAME: string }>(databaseName, `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = N'${escapedSchema}'
        AND TABLE_NAME = N'${escapedTable}'
        AND COLUMN_NAME != N'${escapedExcludeColumn}'
      ORDER BY ORDINAL_POSITION
    `);

    const columns = columnsResult.recordset.map(r => r.COLUMN_NAME);

    // Try to find a column matching our patterns
    for (const pattern of displayPatterns) {
      const found = columns.find(col => 
        col === pattern || 
        col.toLowerCase() === pattern.toLowerCase() ||
        col.includes(pattern) ||
        col.toLowerCase().includes(pattern.toLowerCase())
      );
      if (found) {
        const escapedFound = found.replace(/]/g, ']]');
        return { expression: `{alias}.[${escapedFound}]`, isFullName: false };
      }
    }

    // If no pattern match, return the first non-PK column
    if (columns.length > 0) {
      const escapedFirst = columns[0].replace(/]/g, ']]');
      return { expression: `{alias}.[${escapedFirst}]`, isFullName: false };
    }

    return { expression: '', isFullName: false };
  } catch (error) {
    logger.warn(`Error finding display column for ${schemaName}.${tableName}`, {
      error,
      database: databaseName,
      schema: schemaName,
      table: tableName,
    }, 'DB_FIND_DISPLAY_COLUMN');
    return { expression: '', isFullName: false };
  }
}

/**
 * Get table data with referenced data from foreign key relationships
 * This will join with related tables to show actual data instead of just IDs
 */
export async function getTableDataWithReferences(
  databaseName: DatabaseName,
  schemaName: string,
  tableName: string,
  limit: number = 100,
  offset: number = 0,
  flowId?: string
): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  hasMore: boolean;
  relationships: ForeignKeyInfo[];
}> {
  const flowLog = flowId ? logger.createFlowLogger(flowId) : null;
  
  try {
    if (flowLog) {
      flowLog.info(`Fetching foreign keys for table`);
    } else {
      logger.info(`Fetching data with references from table: ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        limit,
        offset,
      }, 'DB_TABLE_DATA_WITH_REFS');
    }

    // Get foreign keys for this table
    const foreignKeys = await getTableForeignKeys(databaseName, schemaName, tableName, flowId);

    // Escape schema and table names for count query
    const escapedCountSchema = escapeSqlIdentifier(schemaName);
    const escapedCountTable = escapeSqlIdentifier(tableName);

    // Get total row count
    const countResult = await query<{ total: number }>(databaseName, `
      SELECT COUNT(*) as total
      FROM [${escapedCountSchema}].[${escapedCountTable}]
    `);
    const totalRows = countResult.recordset[0]?.total || 0;

    // If no foreign keys, just get regular data
    if (foreignKeys.length === 0) {
      if (flowLog) {
        flowLog.info(`No foreign keys found, using regular data fetch`);
      }
      const regularData = await getTableData(databaseName, schemaName, tableName, limit, offset, flowId);
      return {
        ...regularData,
        relationships: [],
      };
    }

    if (flowLog) {
      flowLog.info(`Found ${foreignKeys.length} foreign keys, building joins`);
    }

    // First, get all columns from the table to maintain original order
    // Escape for use in N'string' format (escape single quotes)
    const escapedSchemaForString = escapeSqlIdentifier(schemaName).replace(/'/g, "''");
    const escapedTableForString = escapeSqlIdentifier(tableName).replace(/'/g, "''");
    
    const allColumnsResult = await query<{ COLUMN_NAME: string }>(databaseName, `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = N'${escapedSchemaForString}'
        AND TABLE_NAME = N'${escapedTableForString}'
      ORDER BY ORDINAL_POSITION
    `);
    
    const allColumns = allColumnsResult.recordset.map(r => r.COLUMN_NAME);
    const fkColumnNames = new Set(foreignKeys.map(fk => fk.FK_COLUMN));
    
    // Create a map of FK column to its join alias and display column
    const fkMap = new Map<string, { alias: string; displayColumn: { expression: string; isFullName: boolean }; fk: ForeignKeyInfo }>();
    
    // Build SELECT clause - keep all columns in original order, replace FK values with referenced data
    const selectColumns: string[] = [];
    const joinClauses: string[] = [];
    
    // Escape schema and table names
    const escapedSchema = escapeSqlIdentifier(schemaName);
    const escapedTable = escapeSqlIdentifier(tableName);
    
    // Process each foreign key to create joins first
    for (let i = 0; i < foreignKeys.length; i++) {
      const fk = foreignKeys[i];
      
      // Create a unique alias for each FK join
      const alias = `ref_${fk.FK_COLUMN}_${i}`;
      
      // Escape column names for SQL injection prevention
      const escapedFkColumn = fk.FK_COLUMN.replace(/]/g, ']]');
      const escapedPkSchema = fk.PK_SCHEMA.replace(/]/g, ']]');
      const escapedPkTable = fk.PK_TABLE.replace(/]/g, ']]');
      const escapedPkColumn = fk.PK_COLUMN.replace(/]/g, ']]');
      
      // Create the join with the correct FK_COLUMN to PK_COLUMN mapping
      joinClauses.push(`
        LEFT JOIN [${escapedPkSchema}].[${escapedPkTable}] AS ${alias}
          ON [${escapedSchema}].[${escapedTable}].[${escapedFkColumn}] = ${alias}.[${escapedPkColumn}]
      `);
      
      // Find display column for this specific FK relationship
      const displayInfo = await findDisplayColumn(
        databaseName,
        fk.PK_SCHEMA,
        fk.PK_TABLE,
        fk.PK_COLUMN,
        fk.FK_COLUMN
      );
      
      // Store FK mapping
      fkMap.set(fk.FK_COLUMN, { alias, displayColumn: displayInfo, fk });
    }
    
    // Now build SELECT clause maintaining original column order
    for (const column of allColumns) {
      const escapedColumn = column.replace(/]/g, ']]');
      
      if (fkColumnNames.has(column)) {
        // This is an FK column - combine ID and display value in same column
        const fkInfo = fkMap.get(column);
        if (fkInfo) {
          // Get display value from referenced table
          let displayValueExpr: string;
          
          // Check if we need full name (Ho + Ten) for Oid and similar columns
          if (fkInfo.displayColumn.isFullName) {
            const fullNameExpr = await findFullNameExpression(
              databaseName,
              fkInfo.fk.PK_SCHEMA,
              fkInfo.fk.PK_TABLE,
              fkInfo.alias,
              fkInfo.fk.PK_COLUMN
            );
            
            if (fullNameExpr) {
              displayValueExpr = fullNameExpr;
            } else {
              // Fallback: try to find any name-like column in the referenced table
              // Get all columns from the referenced table
              const refColumnsResult = await query<{ COLUMN_NAME: string }>(databaseName, `
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = N'${fkInfo.fk.PK_SCHEMA.replace(/'/g, "''")}'
                  AND TABLE_NAME = N'${fkInfo.fk.PK_TABLE.replace(/'/g, "''")}'
                  AND COLUMN_NAME != N'${fkInfo.fk.PK_COLUMN.replace(/'/g, "''")}'
                ORDER BY ORDINAL_POSITION
              `);
              
              const refColumns = refColumnsResult.recordset.map(r => r.COLUMN_NAME);
              const namePatterns = ['name', 'ten', 'tên', 'hoten', 'họ tên', 'holoten', 'họ và tên'];
              
              // Try to find a name column
              let nameColumn: string | null = null;
              for (const pattern of namePatterns) {
                const found = refColumns.find(col => 
                  col.toLowerCase() === pattern || 
                  col.toLowerCase().includes(pattern.toLowerCase())
                );
                if (found) {
                  nameColumn = found;
                  break;
                }
              }
              
              if (nameColumn) {
                const escapedName = nameColumn.replace(/]/g, ']]');
                displayValueExpr = `${fkInfo.alias}.[${escapedName}]`;
              } else {
                // Last resort: use the first non-PK column
                const firstCol = refColumns[0];
                if (firstCol) {
                  const escapedFirst = firstCol.replace(/]/g, ']]');
                  displayValueExpr = `${fkInfo.alias}.[${escapedFirst}]`;
                } else {
                  // Ultimate fallback: use PK column itself
                  displayValueExpr = `${fkInfo.alias}.[${fkInfo.fk.PK_COLUMN.replace(/]/g, ']]')}]`;
                }
              }
            }
          } else {
            // Use regular display column
            displayValueExpr = fkInfo.displayColumn.expression 
              ? fkInfo.displayColumn.expression.replace('{alias}', fkInfo.alias)
              : `${fkInfo.alias}.[${fkInfo.fk.PK_COLUMN.replace(/]/g, ']]')}]`;
          }
          
          // Combine: display value + newline + "(ID: " + original ID + ")"
          // Format: "DisplayValue\n(ID: OriginalID)" or just "OriginalID" if no display value
          const originalIdColumn = `[${escapedSchema}].[${escapedTable}].[${escapedColumn}]`;
          
          // Build combined expression: if display value exists, show "DisplayValue\n(ID: OriginalID)", otherwise show just "OriginalID"
          // Use CHAR(13) + CHAR(10) for Windows line break (CRLF) or just CHAR(10) for LF
          const combinedExpr = `CASE 
            WHEN ${displayValueExpr} IS NOT NULL AND LTRIM(RTRIM(CAST(${displayValueExpr} AS NVARCHAR(MAX)))) != '' 
            THEN CAST(${displayValueExpr} AS NVARCHAR(MAX)) + CHAR(10) + '(ID: ' + CAST(${originalIdColumn} AS NVARCHAR(MAX)) + ')'
            ELSE CAST(${originalIdColumn} AS NVARCHAR(MAX))
          END`;
          
          // Use combined expression in the same column
          selectColumns.push(`${combinedExpr} AS [${escapedColumn}]`);
          
          // Also keep original ID in a hidden column for filtering/reference
          const originalIdColumnName = `${column}_OriginalId`;
          const escapedOriginalIdColumnName = originalIdColumnName.replace(/]/g, ']]');
          selectColumns.push(`${originalIdColumn} AS [${escapedOriginalIdColumnName}]`);
        } else {
          // Fallback: keep original column if FK info not found
          selectColumns.push(`[${escapedSchema}].[${escapedTable}].[${escapedColumn}]`);
        }
      } else {
        // Regular column - keep original value
        selectColumns.push(`[${escapedSchema}].[${escapedTable}].[${escapedColumn}]`);
      }
    }

    // Escape schema and table names for main query
    const escapedMainSchema = escapeSqlIdentifier(schemaName);
    const escapedMainTable = escapeSqlIdentifier(tableName);
    
    // Build the query with joins
    const selectClause = selectColumns.join(', ');
    const joinClause = joinClauses.join(' ');

    // Log the join conditions for debugging
    if (flowLog) {
      flowLog.debug(`Building query with ${foreignKeys.length} foreign key joins`);
    } else {
      logger.debug(`Building query with ${foreignKeys.length} foreign key joins`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        foreignKeys: foreignKeys.map(fk => ({
          fkColumn: fk.FK_COLUMN,
          pkTable: `${fk.PK_SCHEMA}.${fk.PK_TABLE}`,
          pkColumn: fk.PK_COLUMN,
        })),
        joinCount: joinClauses.length,
      }, 'DB_TABLE_DATA_WITH_REFS');
    }

    const dataResult = await query(databaseName, `
      SELECT TOP ${limit} *
      FROM (
        SELECT ${selectClause}, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) as rn
        FROM [${escapedMainSchema}].[${escapedMainTable}]
        ${joinClause}
      ) AS t
      WHERE t.rn > ${offset}
      ORDER BY t.rn
    `);

    // Get rows and remove ROW_NUMBER column
    const rows = Array.from(dataResult.recordset).map((row: unknown) => {
      const rowObj = row as Record<string, unknown>;
      // Remove ROW_NUMBER column from result
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { rn: _rn, ...rest } = rowObj;
      return rest;
    });

    // Get column names from first row (excluding 'rn')
    const columns = rows.length > 0 
      ? Object.keys(rows[0])
      : [];

    const hasMore = offset + rows.length < totalRows;

    if (flowLog) {
      flowLog.success(`Fetched ${rows.length} rows with references (${columns.length} columns, ${foreignKeys.length} relationships)`);
    } else {
      logger.success(`Successfully fetched ${rows.length} rows with references from ${schemaName}.${tableName}`, {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        rowsReturned: rows.length,
        totalRows,
        hasMore,
        relationshipCount: foreignKeys.length,
      }, 'DB_TABLE_DATA_WITH_REFS');
    }

    return {
      columns,
      rows,
      totalRows,
      hasMore,
      relationships: foreignKeys,
    };
  } catch (error) {
    if (flowLog) {
      flowLog.error(`Error fetching data with references`, error);
    } else {
      logger.error(`Error fetching data with references from table: ${schemaName}.${tableName}`, {
        error,
        database: databaseName,
        schema: schemaName,
        table: tableName,
      }, 'DB_TABLE_DATA_WITH_REFS');
    }
    throw error;
  }
}

// Import auto test to automatically run when module is loaded
if (typeof window === 'undefined') {
  // Import to trigger auto test
  import('./auto-test-connection');
}

// Close connections when application shuts down (Next.js)
if (typeof window === 'undefined') {
  process.on('SIGINT', async () => {
    await closeAllConnections();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closeAllConnections();
    process.exit(0);
  });
}

// Re-export for convenience
export { getDatabaseConfigSystem, getDatabaseConfig, getEnabledDatabases } from './db-config';

