import sql from 'mssql';
import { logger } from './logger';

export type DatabaseName = 'PSC_HRM' | 'HRM_HUB';

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
 * Get SQL Server connection configuration for a specific database
 */
function getConfig(databaseName: DatabaseName): sql.config {
  const server = process.env.DB_SERVER || 'DESKTOP-F3UFVI3';
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined;
  const instanceName = process.env.DB_INSTANCE_NAME;
  
  // Split server name and instance name
  const hasInstanceInServer = server.includes('\\');
  let serverName = server;
  let extractedInstanceName: string | undefined;
  
  if (hasInstanceInServer) {
    const parts = server.split('\\');
    serverName = parts[0];
    extractedInstanceName = parts[1];
  }
  
  // Logic: If instance name exists, prioritize using instance name (via SQL Browser)
  // Only use port directly when there's no instance name (default instance)
  const finalInstanceName = instanceName || extractedInstanceName;
  const usePortDirectly = port && !finalInstanceName;

  const baseConfig: sql.config = {
    server: serverName,
    database: databaseName,
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000'),
    ...(usePortDirectly ? { port } : {}),
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
      port,
      database: databaseName
    }, 'DB_CONFIG');
  } else if (finalInstanceName) {
    logger.debug('Using instance name (SQL Browser will find port)', { 
      server: serverName, 
      instanceName: finalInstanceName,
      database: databaseName
    }, 'DB_CONFIG');
  }

  // Windows Authentication (default) - no user/password needed
  if (process.env.DB_USE_WINDOWS_AUTH === 'true' || !process.env.DB_USER) {
    logger.debug('Using Windows Authentication', {
      currentUser: process.env.USERNAME || process.env.USER,
      database: databaseName,
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
    user: process.env.DB_USER,
    database: databaseName,
  }, 'DB_CONFIG');
  return {
    ...baseConfig,
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
  };
}

// Database connection pools
const databases: Record<DatabaseName, DatabaseConfig> = {
  PSC_HRM: {
    name: 'PSC_HRM',
    pool: null,
    config: getConfig('PSC_HRM'),
  },
  HRM_HUB: {
    name: 'HRM_HUB',
    pool: null,
    config: getConfig('HRM_HUB'),
  },
};

// Log connection configurations
Object.values(databases).forEach((db) => {
  logger.debug('Database connection configuration', {
    server: db.config.server,
    port: db.config.port,
    database: db.config.database,
    connectionTimeout: db.config.connectionTimeout,
    requestTimeout: db.config.requestTimeout,
    instanceName: db.config.options?.instanceName,
    encrypt: db.config.options?.encrypt,
    authentication: db.config.user ? 'SQL Server Authentication' : 'Windows Authentication',
  }, 'DB_CONFIG');
});

/**
 * Get or create connection pool for a specific database
 */
export async function getConnection(databaseName: DatabaseName): Promise<sql.ConnectionPool> {
  const db = databases[databaseName];
  
  if (!db.pool) {
    const startTime = Date.now();
    logger.logConnectionState('connecting', {
      server: db.config.server,
      database: db.config.database,
    });

    try {
      db.pool = await sql.connect(db.config);
      const duration = Date.now() - startTime;
      logger.logConnectionState('connected', {
        server: db.config.server,
        database: db.config.database,
        duration,
      });
    } catch (error) {
      logger.logConnectionState('error', {
        server: db.config.server,
        database: db.config.database,
        error,
      });
      throw error;
    }
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
  await Promise.all([
    closeConnection('PSC_HRM'),
    closeConnection('HRM_HUB'),
  ]);
}

/**
 * Execute query on a specific database
 */
export async function query<T = sql.IResult<unknown>>(
  databaseName: DatabaseName,
  queryString: string,
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
 */
export async function testAllConnections(): Promise<Record<DatabaseName, boolean>> {
  const results = await Promise.all([
    testConnection('PSC_HRM').then(result => ({ name: 'PSC_HRM' as DatabaseName, connected: result })),
    testConnection('HRM_HUB').then(result => ({ name: 'HRM_HUB' as DatabaseName, connected: result })),
  ]);

  return {
    PSC_HRM: results[0].connected,
    HRM_HUB: results[1].connected,
  };
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

