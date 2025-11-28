/**
 * Utility to store and retrieve database configuration from localStorage
 * Falls back to env config if no user config exists
 */

import type { DatabaseName, DatabaseConfigItem } from '@/lib/db-config';
import { getDatabaseConfig, mergeConfigWithDefaults } from '@/lib/db-config';

const STORAGE_KEY = 'db_user_config';
const MAX_DATABASES_STORAGE_KEY = 'db_max_databases_to_show';

export interface UserDatabaseConfig {
  [key: string]: Partial<DatabaseConfigItem>;
}

/**
 * Get user configuration from localStorage
 */
export function getUserDatabaseConfig(): UserDatabaseConfig {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as UserDatabaseConfig;
    }
  } catch (error) {
    console.error('Error reading database config from localStorage:', error);
  }

  return {};
}

/**
 * Save user configuration to localStorage
 */
export function saveUserDatabaseConfig(config: UserDatabaseConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving database config to localStorage:', error);
  }
}

/**
 * Get merged configuration (user config + env config)
 * Returns: userConfig || envConfig || defaults
 * Uses mergeConfigWithDefaults to ensure no null/undefined values
 */
export function getMergedDatabaseConfig(databaseName: DatabaseName): DatabaseConfigItem {
  const envConfig = getDatabaseConfig(databaseName);
  const userConfig = getUserDatabaseConfig()[databaseName];

  // Merge: userConfig || envConfig || defaults
  return mergeConfigWithDefaults(envConfig, userConfig ? {
    ...userConfig,
    name: databaseName,
  } : undefined);
}

/**
 * Update user configuration for a specific database
 */
export function updateUserDatabaseConfig(
  databaseName: DatabaseName,
  config: Partial<DatabaseConfigItem>
): void {
  const userConfigs = getUserDatabaseConfig();
  userConfigs[databaseName] = {
    ...userConfigs[databaseName],
    ...config,
    // Ensure name is always correct
    name: databaseName,
  };
  saveUserDatabaseConfig(userConfigs);
}

/**
 * Reset user configuration for a specific database (use env config)
 */
export function resetUserDatabaseConfig(databaseName: DatabaseName): void {
  const userConfigs = getUserDatabaseConfig();
  delete userConfigs[databaseName];
  saveUserDatabaseConfig(userConfigs);
}

/**
 * Clear all user configurations
 */
export function clearAllUserDatabaseConfig(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing database config from localStorage:', error);
  }
}

/**
 * Get maximum number of databases to show (1 or 2)
 * Defaults to 2 if not set
 */
export function getMaxDatabasesToShow(): 1 | 2 {
  if (typeof window === 'undefined') {
    return 2; // Server-side default
  }

  try {
    const stored = localStorage.getItem(MAX_DATABASES_STORAGE_KEY);
    if (stored) {
      const value = parseInt(stored, 10);
      return (value === 1 || value === 2) ? value : 2;
    }
  } catch (error) {
    console.error('Error reading max databases config from localStorage:', error);
  }

  // Check env variable as fallback
  if (typeof process !== 'undefined' && process.env) {
    const envValue = process.env.MAX_DATABASES_TO_SHOW;
    if (envValue) {
      const value = parseInt(envValue, 10);
      return (value === 1 || value === 2) ? value : 2;
    }
  }

  return 2; // Default to 2
}

/**
 * Set maximum number of databases to show (1 or 2)
 */
export function setMaxDatabasesToShow(count: 1 | 2): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(MAX_DATABASES_STORAGE_KEY, count.toString());
  } catch (error) {
    console.error('Error saving max databases config to localStorage:', error);
  }
}

