import { NextRequest, NextResponse } from 'next/server';
import { getTableForeignKeys } from '@/lib/db-manager';
import { getDatabaseConfig } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const databaseName = searchParams.get('database') as DatabaseName;
  const schemaName = searchParams.get('schema');
  const tableName = searchParams.get('table');

  // Validate required parameters
  if (!databaseName || !schemaName || !tableName) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing required parameters: database, schema, and table are required',
        error: 'Missing parameters',
      },
      { status: 400 }
    );
  }

  // Validate database name
  if (databaseName !== 'database_1' && databaseName !== 'database_2') {
    return NextResponse.json(
      {
        success: false,
        message: `Invalid database name: ${databaseName}. Must be 'database_1' or 'database_2'`,
        error: 'Invalid database name',
      },
      { status: 400 }
    );
  }

  const flowName = `API_GET_TABLE_RELATIONSHIPS_${databaseName.toUpperCase()}`;
  const flowId = logger.startFlow(flowName, {
    database: databaseName,
    schema: schemaName,
    table: tableName,
  });
  const flowLog = logger.createFlowLogger(flowId);

  try {
    flowLog.info(`Validating database configuration`);
    
    // Get database config
    const dbConfig = getDatabaseConfig(databaseName);
    if (!dbConfig.enabled) {
      flowLog.error(`Database ${databaseName} is disabled`);
      flowLog.end(false, { reason: 'Database disabled' });
      return NextResponse.json(
        {
          success: false,
          message: `Database ${databaseName} is disabled`,
          error: 'Database disabled',
        },
        { status: 400 }
      );
    }

    flowLog.success(`Database ${databaseName} is enabled`);
    flowLog.info(`Fetching foreign key relationships for ${schemaName}.${tableName}`);

    // Fetch foreign keys
    const foreignKeys = await getTableForeignKeys(
      databaseName,
      schemaName,
      tableName,
      flowId
    );

    flowLog.success(`Relationships fetched successfully`, {
      relationshipCount: foreignKeys.length,
    });

    flowLog.end(true, {
      relationshipCount: foreignKeys.length,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully fetched relationships for ${schemaName}.${tableName}`,
      data: {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        relationships: foreignKeys,
      },
    });
  } catch (error) {
    flowLog.error('Unexpected error in API get table relationships', error);
    flowLog.end(false, { error: error instanceof Error ? error.message : 'Unknown error' });

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch table relationships',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

