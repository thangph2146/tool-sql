import { NextRequest } from 'next/server';
import { escapeSqlIdentifier, convertToSqlConfig } from '@/lib/db-manager';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import { HTTP_STATUS_INTERNAL_SERVER_ERROR, VALID_DATABASES } from '@/lib/constants/db-constants';
import { errorResponse, successResponse, validateRequiredParams } from '@/lib/utils/api-response';
import { getMergedConfigFromParams } from '@/lib/utils/api-config-helper';
import sql from 'mssql';

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

  const flowName = `API_TEST_TABLE_${databaseName.toUpperCase()}`;
  const flowId = logger.startFlow(flowName, {
    database: databaseName,
    schema: schemaName,
    table: tableName,
  });
  const flowLog = logger.createFlowLogger(flowId);

  try {
    flowLog.info(`Testing table accessibility: ${schemaName}.${tableName}`);

    // Get merged config: customConfig || envConfig || defaults
    const customConfigParam = searchParams.get('config');
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

    // Try to query 1 row from the table to test accessibility
    try {
      // Escape schema and table names for SQL Server
      const escapedSchema = escapeSqlIdentifier(schemaName!);
      const escapedTable = escapeSqlIdentifier(tableName!);
      
      // Always use merged config for consistency: customConfig || envConfig || defaults
      const sqlConfig = convertToSqlConfig(dbConfig);
      const tempPool = new sql.ConnectionPool(sqlConfig);
      await tempPool.connect();
      try {
        const testResult = await tempPool.request().query(`
          SELECT TOP 1 *
          FROM [${escapedSchema}].[${escapedTable}]
        `);

        // Get column count from first row if available
        const columnsCount = testResult.recordset.length > 0 && testResult.recordset[0]
          ? Object.keys(testResult.recordset[0]).length
          : 0;
        const hasData = testResult.recordset.length > 0;

        flowLog.success(`Table ${schemaName}.${tableName} is accessible`, {
          columnsCount,
          hasData,
        });

        flowLog.end(true, {
          accessible: true,
          hasData,
          columnsCount,
        });

        return successResponse(
          `Table ${schemaName}.${tableName} is accessible`,
          {
            database: databaseName,
            schema: schemaName,
            table: tableName,
            accessible: true,
            hasData,
            columnsCount,
          }
        );
      } finally {
        await tempPool.close();
      }
    } catch (queryError) {
      const errorMessage = queryError instanceof Error 
        ? queryError.message 
        : 'Unknown query error';
      
      flowLog.error(`Table ${schemaName}.${tableName} is not accessible`, queryError);
      flowLog.end(false, { error: errorMessage });

      return errorResponse(
        `Table ${schemaName}.${tableName} is not accessible: ${errorMessage}`,
        errorMessage,
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    flowLog.error('Unexpected error in API test table', error);
    flowLog.end(false, { error: errorMessage });

    return errorResponse(
      'Failed to test table',
      errorMessage,
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
}

