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
export async function testConnection(databaseName: DatabaseName): Promise<boolean> {
  try {
    logger.info(`Testing connection to database: ${databaseName}...`, {
      server: databases[databaseName].config.server,
      database: databases[databaseName].config.database,
    }, 'DB_TEST');
    const result = await query(databaseName, 'SELECT 1 as test');
    const isConnected = result.recordset.length > 0;
    if (isConnected) {
      logger.success(`Connection test successful for database: ${databaseName}`, {
        server: databases[databaseName].config.server,
        database: databases[databaseName].config.database,
      }, 'DB_TEST');
    } else {
      logger.warn(`Connection test returned no results for database: ${databaseName}`, {
        server: databases[databaseName].config.server,
        database: databases[databaseName].config.database,
      }, 'DB_TEST');
    }
    return isConnected;
  } catch (error) {
    logger.error(`Connection test error for database: ${databaseName}`, {
      error,
      server: databases[databaseName].config.server,
      database: databases[databaseName].config.database,
    }, 'DB_TEST');
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
export async function getTables(databaseName: DatabaseName): Promise<TableInfo[]> {
  try {
    logger.info(`Fetching tables from database: ${databaseName}...`, {
      database: databaseName,
    }, 'DB_TABLES');

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
        logger.warn(`Database context mismatch detected. Expected ${expectedDatabase}, got ${currentDb}`, {
          expected: expectedDatabase,
          actual: currentDb,
          databaseName, // System key (database_1 or database_2)
        }, 'DB_TABLES');
      }
    }
    
    // Remove CURRENT_DB from result before returning
    const cleanedTables: TableInfo[] = tables.map((table) => ({
      TABLE_SCHEMA: table.TABLE_SCHEMA,
      TABLE_NAME: table.TABLE_NAME,
      TABLE_TYPE: table.TABLE_TYPE,
    }));
    
    logger.success(`Successfully fetched ${cleanedTables.length} tables from database: ${databaseName}`, {
      database: databaseName,
      tableCount: cleanedTables.length,
    }, 'DB_TABLES');

    return cleanedTables;
  } catch (error) {
    logger.error(`Error fetching tables from database: ${databaseName}`, {
      error,
      database: databaseName,
    }, 'DB_TABLES');
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
    const result = await query<{ row_count: number }>(databaseName, `
      SELECT COUNT(*) as row_count
      FROM [${schemaName}].[${tableName}]
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

