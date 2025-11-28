import { NextResponse } from 'next/server';
import { getDatabaseConfigSystem, getDatabaseConfig, validateDatabaseConfig, getConfigSummary } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import type { DatabaseName } from '@/lib/db-config';
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@/lib/constants/db-constants';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const databaseParam = searchParams.get('database') as DatabaseName | null;

    if (databaseParam && (databaseParam === 'database_1' || databaseParam === 'database_2')) {
      // Get config for single database
      logger.info(`API get config called for database: ${databaseParam}`, undefined, 'API_DB_CONFIG');
      
      const config = getDatabaseConfig(databaseParam);
      const validation = validateDatabaseConfig(databaseParam);
      
      return NextResponse.json({
        success: true,
        message: `Configuration for ${databaseParam}`,
        data: {
          database: databaseParam,
          config: {
            ...config,
            password: config.password ? '***' : undefined, // Hide password
          },
          validation,
        },
      });
    } else {
      // Get config for all databases
      logger.info('API get config called for all databases', undefined, 'API_DB_CONFIG');
      
      const configSystem = getDatabaseConfigSystem();
      const configs: Record<string, unknown> = {};
      
      Object.entries(configSystem.databases).forEach(([name, config]) => {
        const validation = validateDatabaseConfig(name as DatabaseName);
        configs[name] = {
          ...config,
          password: config.password ? '***' : undefined, // Hide password
          validation,
        };
      });
      
      return NextResponse.json({
        success: true,
        message: 'Database configuration system',
        data: {
          summary: getConfigSummary(),
          databases: configs,
        },
      });
    }
  } catch (error) {
    logger.error('Error in API get config', error, 'API_DB_CONFIG');
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching configuration',
        error: errorMessage,
      },
      { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
    );
  }
}

