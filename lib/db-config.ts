/**
 * Database Configuration System
 * Manages configuration for multiple databases (database_1 and database_2)
 */

export type DatabaseName = 'database_1' | 'database_2';

export interface DatabaseConfigItem {
  name: DatabaseName;
  displayName: string;
  description?: string;
  server: string;
  port?: number;
  instanceName?: string;
  database: string;
  useWindowsAuth: boolean;
  user?: string;
  password?: string;
  connectionTimeout?: number;
  requestTimeout?: number;
  enabled: boolean;
}

export interface DatabaseConfigSystem {
  databases: Record<DatabaseName, DatabaseConfigItem>;
  defaultServer: string;
  defaultPort?: number;
  defaultInstanceName?: string;
  defaultConnectionTimeout: number;
  defaultRequestTimeout: number;
}

/**
 * Get database configuration from environment variables or defaults
 */
export function getDatabaseConfigSystem(): DatabaseConfigSystem {
  // Support legacy configuration (backward compatibility)
  // These are the required old configuration variables (lines 1-7 in .env)
  const defaultServer = process.env.DB_SERVER || 'DESKTOP-F3UFVI3';
  const defaultPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined;
  const defaultInstanceName = process.env.DB_INSTANCE_NAME;
  const defaultConnectionTimeout = parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000');
  const defaultRequestTimeout = parseInt(process.env.DB_REQUEST_TIMEOUT || '30000');
  const useWindowsAuth = process.env.DB_USE_WINDOWS_AUTH === 'true' || !process.env.DB_USER;
  
  // Legacy DB_DATABASE support (if exists, use as fallback for database_1)
  const legacyDatabase = process.env.DB_DATABASE;

  // Database 1 Configuration
  // database_1 is the system key, actual database name can be configured (default: PSC_HRM)
  // Supports legacy DB_DATABASE for backward compatibility
  const database1Config: DatabaseConfigItem = {
    name: 'database_1',
    displayName: process.env.DATABASE_1_DISPLAY_NAME || 'Database 1',
    description: process.env.DATABASE_1_DESCRIPTION || 'First database configuration',
    server: process.env.DATABASE_1_SERVER || defaultServer,
    port: process.env.DATABASE_1_PORT ? parseInt(process.env.DATABASE_1_PORT) : defaultPort,
    instanceName: process.env.DATABASE_1_INSTANCE_NAME || defaultInstanceName,
    database: process.env.DATABASE_1_NAME || legacyDatabase || 'PSC_HRM', // Support legacy DB_DATABASE, default to PSC_HRM
    useWindowsAuth: process.env.DATABASE_1_USE_WINDOWS_AUTH === 'true' || 
                    (process.env.DATABASE_1_USE_WINDOWS_AUTH !== 'false' && useWindowsAuth),
    // Only set user/password if NOT using Windows Authentication
    user: (process.env.DATABASE_1_USE_WINDOWS_AUTH === 'true' || 
           (process.env.DATABASE_1_USE_WINDOWS_AUTH !== 'false' && useWindowsAuth))
      ? undefined
      : (process.env.DATABASE_1_USER || process.env.DB_USER),
    password: (process.env.DATABASE_1_USE_WINDOWS_AUTH === 'true' || 
               (process.env.DATABASE_1_USE_WINDOWS_AUTH !== 'false' && useWindowsAuth))
      ? undefined
      : (process.env.DATABASE_1_PASSWORD || process.env.DB_PASSWORD),
    connectionTimeout: process.env.DATABASE_1_CONNECTION_TIMEOUT 
      ? parseInt(process.env.DATABASE_1_CONNECTION_TIMEOUT) 
      : defaultConnectionTimeout,
    requestTimeout: process.env.DATABASE_1_REQUEST_TIMEOUT 
      ? parseInt(process.env.DATABASE_1_REQUEST_TIMEOUT) 
      : defaultRequestTimeout,
    enabled: process.env.DATABASE_1_ENABLED !== 'false', // Enabled by default
  };

  // Database 2 Configuration
  // database_2 is the system key, actual database name can be configured (default: HRM_HUB)
  const database2Config: DatabaseConfigItem = {
    name: 'database_2',
    displayName: process.env.DATABASE_2_DISPLAY_NAME || 'Database 2',
    description: process.env.DATABASE_2_DESCRIPTION || 'Second database configuration',
    server: process.env.DATABASE_2_SERVER || defaultServer,
    port: process.env.DATABASE_2_PORT ? parseInt(process.env.DATABASE_2_PORT) : defaultPort,
    instanceName: process.env.DATABASE_2_INSTANCE_NAME || defaultInstanceName,
    database: process.env.DATABASE_2_NAME || 'HRM_HUB', // Default to HRM_HUB
    useWindowsAuth: process.env.DATABASE_2_USE_WINDOWS_AUTH === 'true' || 
                    (process.env.DATABASE_2_USE_WINDOWS_AUTH !== 'false' && useWindowsAuth),
    // Only set user/password if NOT using Windows Authentication
    user: (process.env.DATABASE_2_USE_WINDOWS_AUTH === 'true' || 
           (process.env.DATABASE_2_USE_WINDOWS_AUTH !== 'false' && useWindowsAuth))
      ? undefined
      : (process.env.DATABASE_2_USER || process.env.DB_USER),
    password: (process.env.DATABASE_2_USE_WINDOWS_AUTH === 'true' || 
               (process.env.DATABASE_2_USE_WINDOWS_AUTH !== 'false' && useWindowsAuth))
      ? undefined
      : (process.env.DATABASE_2_PASSWORD || process.env.DB_PASSWORD),
    connectionTimeout: process.env.DATABASE_2_CONNECTION_TIMEOUT 
      ? parseInt(process.env.DATABASE_2_CONNECTION_TIMEOUT) 
      : defaultConnectionTimeout,
    requestTimeout: process.env.DATABASE_2_REQUEST_TIMEOUT 
      ? parseInt(process.env.DATABASE_2_REQUEST_TIMEOUT) 
      : defaultRequestTimeout,
    enabled: process.env.DATABASE_2_ENABLED !== 'false', // Enabled by default
  };

  return {
    databases: {
      database_1: database1Config,
      database_2: database2Config,
    },
    defaultServer,
    defaultPort,
    defaultInstanceName,
    defaultConnectionTimeout,
    defaultRequestTimeout,
  };
}

/**
 * Get configuration for a specific database
 */
export function getDatabaseConfig(databaseName: DatabaseName): DatabaseConfigItem {
  const configSystem = getDatabaseConfigSystem();
  return configSystem.databases[databaseName];
}

/**
 * Get all enabled databases
 */
export function getEnabledDatabases(): DatabaseConfigItem[] {
  const configSystem = getDatabaseConfigSystem();
  return Object.values(configSystem.databases).filter(db => db.enabled);
}

/**
 * Check if a database is enabled
 */
export function isDatabaseEnabled(databaseName: DatabaseName): boolean {
  const config = getDatabaseConfig(databaseName);
  return config.enabled;
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(databaseName: DatabaseName): {
  valid: boolean;
  errors: string[];
} {
  const config = getDatabaseConfig(databaseName);
  const errors: string[] = [];

  if (!config.enabled) {
    errors.push(`${databaseName} is disabled`);
  }

  if (!config.server) {
    errors.push(`${databaseName}: Server is required`);
  }

  if (!config.database) {
    errors.push(`${databaseName}: Database name is required`);
  }

  if (!config.useWindowsAuth) {
    if (!config.user) {
      errors.push(`${databaseName}: User is required when not using Windows Authentication`);
    }
    if (!config.password) {
      errors.push(`${databaseName}: Password is required when not using Windows Authentication`);
    }
  }

  if (config.connectionTimeout && config.connectionTimeout < 1000) {
    errors.push(`${databaseName}: Connection timeout must be at least 1000ms`);
  }

  if (config.requestTimeout && config.requestTimeout < 1000) {
    errors.push(`${databaseName}: Request timeout must be at least 1000ms`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary(): {
  defaultServer: string;
  defaultPort?: number;
  defaultInstanceName?: string;
  databases: Record<string, {
    enabled: boolean;
    server: string;
    port?: number;
    instanceName?: string;
    database: string;
    useWindowsAuth: boolean;
    hasUser: boolean;
    connectionTimeout: number;
    requestTimeout: number;
  }>;
} {
  const configSystem = getDatabaseConfigSystem();
  const databases: Record<string, {
    enabled: boolean;
    server: string;
    port?: number;
    instanceName?: string;
    database: string;
    useWindowsAuth: boolean;
    hasUser: boolean;
    connectionTimeout: number;
    requestTimeout: number;
  }> = {};

  Object.entries(configSystem.databases).forEach(([name, config]) => {
    databases[name] = {
      enabled: config.enabled,
      server: config.server,
      port: config.port,
      instanceName: config.instanceName,
      database: config.database,
      useWindowsAuth: config.useWindowsAuth,
      hasUser: !!config.user,
      connectionTimeout: config.connectionTimeout || 30000,
      requestTimeout: config.requestTimeout || 30000,
    };
  });

  return {
    defaultServer: configSystem.defaultServer,
    defaultPort: configSystem.defaultPort,
    defaultInstanceName: configSystem.defaultInstanceName,
    databases,
  };
}

