import { NextResponse } from 'next/server';
import { getTables, type DatabaseName, type TableInfo } from '@/lib/db-manager';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const databaseParam = searchParams.get('database') as DatabaseName | null;

  // Single database request validation
  if (databaseParam && databaseParam !== 'database_1' && databaseParam !== 'database_2') {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Invalid database parameter. Use ?database=database_1 or ?database=database_2, or omit parameter to get all databases' 
      },
      { status: 400 }
    );
  }

  const flowName = databaseParam 
    ? `API_GET_TABLES_${databaseParam.toUpperCase()}`
    : 'API_GET_TABLES_ALL';
  const flowId = logger.startFlow(flowName, { database: databaseParam || 'all' });
  const flowLog = logger.createFlowLogger(flowId);

  try {
    // If no database parameter, return tables for all databases
    if (!databaseParam) {
      flowLog.info('Fetching tables from all databases in parallel');
      
      // Fetch tables for both databases in parallel
      const [database1Tables, database2Tables] = await Promise.allSettled([
        getTables('database_1', flowId),
        getTables('database_2', flowId),
      ]);

      flowLog.info('Processing results from parallel fetches');

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
      
      if (database1Tables.status === 'fulfilled') {
        flowLog.success(`Database_1: ${tablesData.database_1.tables.length} tables retrieved`);
      } else {
        flowLog.error(`Database_1: Failed - ${tablesData.database_1.error}`);
      }
      
      if (database2Tables.status === 'fulfilled') {
        flowLog.success(`Database_2: ${tablesData.database_2.tables.length} tables retrieved`);
      } else {
        flowLog.error(`Database_2: Failed - ${tablesData.database_2.error}`);
      }

      flowLog.end(allSuccess, { 
        database_1: { count: tablesData.database_1.tables.length, success: tablesData.database_1.success },
        database_2: { count: tablesData.database_2.tables.length, success: tablesData.database_2.success },
      });

      return NextResponse.json({
        success: allSuccess,
        message: allSuccess 
          ? 'Successfully retrieved tables from all databases' 
          : 'Some databases failed to retrieve tables',
        data: tablesData,
      });
    }

    // Single database request
    flowLog.info(`Fetching tables from database: ${databaseParam}`);
    
    const tables = await getTables(databaseParam, flowId);
    
    flowLog.end(true, { 
      tableCount: tables.length 
    });

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
    flowLog.error('Unexpected error in API get tables', error);
    flowLog.end(false, { error: error instanceof Error ? error.message : 'Unknown error' });
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

