import { NextRequest } from 'next/server';
import { getTableStatsWithConfig } from '@/lib/db-manager';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import { FLOW_NAMES } from '@/lib/constants/flow-constants';
import { HTTP_STATUS_INTERNAL_SERVER_ERROR, VALID_DATABASES } from '@/lib/constants/db-constants';
import { errorResponse, successResponse, validateRequiredParams } from '@/lib/utils/api-response';
import { getMergedConfigFromParams } from '@/lib/utils/api-config-helper';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const databaseName = searchParams.get('database') as DatabaseName;
  const schemaName = searchParams.get('schema');
  const tableName = searchParams.get('table');

  // Validate required parameters
  const validation = validateRequiredParams(
    { database: databaseName, schema: schemaName, table: tableName },
    ['database', 'schema', 'table']
  );

  if (!validation.valid) {
    return errorResponse(
      `Missing required parameters: ${validation.missing.join(', ')}`,
      'Missing parameters'
    );
  }

  // Validate database name
  if (!VALID_DATABASES.includes(databaseName as typeof VALID_DATABASES[number])) {
    return errorResponse(
      `Invalid database name: ${databaseName}. Must be one of: ${VALID_DATABASES.join(', ')}`,
      'Invalid database name'
    );
  }

  const flowName = FLOW_NAMES.API_GET_TABLE_STATS(databaseName);
  const flowId = logger.startFlow(flowName, {
    database: databaseName,
    schema: schemaName,
    table: tableName,
  });
  const flowLog = logger.createFlowLogger(flowId);

  try {
    flowLog.info(`Validating database configuration`);
    
    // Get merged config: customConfig || envConfig || defaults
    const customConfigParam = request.nextUrl.searchParams.get('config');
    flowLog.info(`Getting database configuration`, { 
      database: databaseName,
      hasCustomConfig: !!customConfigParam 
    });
    const dbConfig = getMergedConfigFromParams(databaseName, customConfigParam, flowLog);
    
    if (!dbConfig.enabled) {
      flowLog.error(`Database ${databaseName} is disabled`);
      flowLog.end(false, { reason: 'Database disabled' });
      return errorResponse(
        `Database ${databaseName} is disabled`,
        'Database disabled'
      );
    }

    flowLog.success(`Database ${databaseName} is enabled`);
    flowLog.info(`Fetching table stats for ${schemaName}.${tableName}`);

    // Always use *WithConfig function for consistency: customConfig || envConfig || defaults
    const stats = await getTableStatsWithConfig(
      dbConfig,
      schemaName!,
      tableName!,
      flowId
    );

    const summary = {
      rowCount: stats.rowCount,
      columnCount: stats.columnCount,
      relationshipCount: stats.relationshipCount,
    };

    flowLog.success('Table stats fetched successfully', summary);
    flowLog.end(true, summary);

    return successResponse(
      `Successfully fetched table stats for ${schemaName}.${tableName}`,
      {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        ...stats,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    flowLog.error('Unexpected error in API get table stats', error);
    flowLog.end(false, { error: errorMessage });

    return errorResponse('Failed to fetch table stats', errorMessage, HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }
}

