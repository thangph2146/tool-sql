/**
 * API Utilities
 * Helper functions for API operations
 */

import type { DatabaseName } from '@/lib/db-config';

/**
 * Build query string with user config
 */
export async function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
  databaseName?: DatabaseName
): Promise<string> {
  const searchParams = new URLSearchParams();

  // Add regular params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  // Add user config if available
  if (databaseName && typeof window !== 'undefined') {
    try {
      const { getUserDatabaseConfig } = await import('@/lib/utils/db-config-storage');
      const userConfigs = getUserDatabaseConfig();
      const userConfig = userConfigs[databaseName];
      
      if (userConfig) {
        searchParams.append('config', JSON.stringify(userConfig));
      }
    } catch (error) {
      // Silently fail - will use env config
      console.warn('Failed to get user config:', error);
    }
  }

  return searchParams.toString();
}

/**
 * Create API URL with query params
 */
export async function createApiUrl(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined>,
  databaseName?: DatabaseName
): Promise<string> {
  const queryString = await buildQueryString(params, databaseName);
  return queryString ? `${endpoint}?${queryString}` : endpoint;
}

