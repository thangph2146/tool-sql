import { NextRequest, NextResponse } from 'next/server';
import { getTableData } from '@/lib/db-manager';
import { getDatabaseConfig } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const databaseName = searchParams.get('database') as DatabaseName;
    const schemaName = searchParams.get('schema');
    const tableName = searchParams.get('table');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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

    // Validate limit and offset
    if (limit < 1) {
      return NextResponse.json(
        {
          success: false,
          message: 'Limit must be >= 1',
          error: 'Invalid limit',
        },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Offset must be >= 0',
          error: 'Invalid offset',
        },
        { status: 400 }
      );
    }

    logger.info(`API get table data called for database: ${databaseName}`, {
      database: databaseName,
      schema: schemaName,
      table: tableName,
      limit,
      offset,
    }, 'API_DB_TABLE_DATA');

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

    // Fetch table data
    const tableData = await getTableData(
      databaseName,
      schemaName,
      tableName,
      limit,
      offset
    );

    logger.success(`API get table data successful for database: ${databaseName}`, {
      database: databaseName,
      schema: schemaName,
      table: tableName,
      rowsReturned: tableData.rows.length,
      totalRows: tableData.totalRows,
    }, 'API_DB_TABLE_DATA');

    return NextResponse.json({
      success: true,
      message: `Successfully fetched data from ${schemaName}.${tableName}`,
      data: {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        columns: tableData.columns,
        rows: tableData.rows,
        totalRows: tableData.totalRows,
        hasMore: tableData.hasMore,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('Error in API get table data', {
      error,
    }, 'API_DB_TABLE_DATA');

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch table data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

