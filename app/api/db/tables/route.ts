import { NextResponse } from 'next/server';
import { getTables, type DatabaseName, type TableInfo } from '@/lib/db-manager';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const databaseParam = searchParams.get('database') as DatabaseName | null;

    // If no database parameter, return tables for all databases
    if (!databaseParam) {
      logger.info('API get tables called for all databases', undefined, 'API_DB_TABLES');
      
      // Fetch tables for both databases in parallel
      const [database1Tables, database2Tables] = await Promise.allSettled([
        getTables('database_1'),
        getTables('database_2'),
      ]);

      const tablesData: Record<string, { tables: TableInfo[]; success: boolean; error?: string }> = {
        database_1: {
          tables: database1Tables.status === 'fulfilled' ? database1Tables.value : [],
          success: database1Tables.status === 'fulfilled',
          error: database1Tables.status === 'rejected' ? database1Tables.reason?.message : undefined,
        },
        database_2: {
          tables: database2Tables.status === 'fulfilled' ? database2Tables.value : [],
          success: database2Tables.status === 'fulfilled',
          error: database2Tables.status === 'rejected' ? database2Tables.reason?.message : undefined,
        },
      };

      const allSuccess = tablesData.database_1.success && tablesData.database_2.success;
      
      logger.success('API get tables completed for all databases', { 
        database_1: { count: tablesData.database_1.tables.length, success: tablesData.database_1.success },
        database_2: { count: tablesData.database_2.tables.length, success: tablesData.database_2.success },
      }, 'API_DB_TABLES');

      return NextResponse.json({
        success: allSuccess,
        message: allSuccess 
          ? 'Successfully retrieved tables from all databases' 
          : 'Some databases failed to retrieve tables',
        data: tablesData,
      });
    }

    // Single database request
    if (databaseParam !== 'database_1' && databaseParam !== 'database_2') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid database parameter. Use ?database=database_1 or ?database=database_2, or omit parameter to get all databases' 
        },
        { status: 400 }
      );
    }

    logger.info(`API get tables called for database: ${databaseParam}`, undefined, 'API_DB_TABLES');
    
    const tables = await getTables(databaseParam);
    
    logger.success(`API get tables successful for database: ${databaseParam}`, { 
      tableCount: tables.length 
    }, 'API_DB_TABLES');

    return NextResponse.json({
      success: true,
      message: `Successfully retrieved ${tables.length} tables from ${databaseParam}`,
      data: {
        database: databaseParam,
        tables,
        count: tables.length,
      },
    });
  } catch (error) {
    logger.error('Error in API get tables', error, 'API_DB_TABLES');
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching tables',
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

