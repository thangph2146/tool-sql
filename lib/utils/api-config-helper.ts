/**
 * API Config Helper
 * Common utilities for parsing and merging database config from API requests
 */

import type { DatabaseName, DatabaseConfigItem } from '@/lib/db-config';
import { getDatabaseConfig, mergeConfigWithDefaults } from '@/lib/db-config';
import { DEFAULT_CONNECTION_TIMEOUT, DEFAULT_REQUEST_TIMEOUT } from '@/lib/constants/db-constants';

/**
 * Flow logger type (returned by logger.createFlowLogger)
 */
type FlowLogger = {
  info: (message: string, data?: unknown) => void;
  success: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  end: (success: boolean, summary?: Record<string, unknown>) => void;
};

/**
 * Get merged config from params: customConfig || envConfig || defaults
 * Short and consistent logic using || operator
 * 
 * @param databaseName - Database name
 * @param customConfigParam - Custom config from query params (JSON string)
 * @param flowLog - Optional flow logger for logging
 * @returns Merged database config with defaults applied
 */
export function getMergedConfigFromParams(
  databaseName: DatabaseName,
  customConfigParam: string | null,
  flowLog?: FlowLogger
): DatabaseConfigItem {
  const envConfig = getDatabaseConfig(databaseName);
  
  // Log env config (always log for full flow tracking)
  flowLog?.info(`Database config: ${databaseName}`, {
    source: 'env',
    server: envConfig.server || '',
    database: envConfig.database || '',
    port: envConfig.port,
    instanceName: envConfig.instanceName || '',
    useWindowsAuth: envConfig.useWindowsAuth,
    enabled: envConfig.enabled,
    connectionTimeout: envConfig.connectionTimeout || DEFAULT_CONNECTION_TIMEOUT,
    requestTimeout: envConfig.requestTimeout || DEFAULT_REQUEST_TIMEOUT,
  });
  
  // Return env config if no custom config
  if (!customConfigParam) {
    flowLog?.info(`Using env config (no custom config provided)`);
    return envConfig;
  }
  
  // Parse and merge: customConfig || envConfig || defaults
  try {
    const customConfig: Partial<DatabaseConfigItem> = JSON.parse(decodeURIComponent(customConfigParam));
    const mergedConfig = mergeConfigWithDefaults(envConfig, { ...customConfig, name: databaseName });
    
    // Log merged config (custom || env || defaults)
    flowLog?.info(`Using merged config (custom || env || defaults)`, {
      source: 'merged',
      server: mergedConfig.server || '',
      database: mergedConfig.database || '',
      port: mergedConfig.port,
      instanceName: mergedConfig.instanceName || '',
      useWindowsAuth: mergedConfig.useWindowsAuth,
      enabled: mergedConfig.enabled,
      connectionTimeout: mergedConfig.connectionTimeout || DEFAULT_CONNECTION_TIMEOUT,
      requestTimeout: mergedConfig.requestTimeout || DEFAULT_REQUEST_TIMEOUT,
      customFields: Object.keys(customConfig),
    });
    
    return mergedConfig;
  } catch (parseError) {
    flowLog?.error(`Error parsing custom config, falling back to env config`, parseError);
    flowLog?.info(`Using env config (fallback after parse error)`);
    return envConfig; // Fallback: envConfig || defaults
  }
}

