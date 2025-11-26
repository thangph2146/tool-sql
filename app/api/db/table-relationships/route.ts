import { NextRequest, NextResponse } from 'next/server';
import { getTableForeignKeys } from '@/lib/db-manager';
import { getDatabaseConfig } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
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

    logger.info(`API get table relationships called for database: ${databaseName}`, {
      database: databaseName,
      schema: schemaName,
      table: tableName,
    }, 'API_DB_TABLE_RELATIONSHIPS');

    // Get database config
    const dbConfig = getDatabaseConfig(databaseName);
    if (!dbConfig.enabled) {
      return NextResponse.json(
        {
          success: false,
          message: `Database ${databaseName} is disabled`,
          error: 'Database disabled',
        },
        { status: 400 }
      );
    }

    // Fetch foreign keys
    const foreignKeys = await getTableForeignKeys(
      databaseName,
      schemaName,
      tableName
    );

    logger.success(`API get table relationships successful for database: ${databaseName}`, {
      database: databaseName,
      schema: schemaName,
      table: tableName,
      relationshipCount: foreignKeys.length,
    }, 'API_DB_TABLE_RELATIONSHIPS');

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
    logger.error('Error in API get table relationships', {
      error,
    }, 'API_DB_TABLE_RELATIONSHIPS');

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

