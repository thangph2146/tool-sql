import { NextResponse } from 'next/server';
import { testAllConnections, query, type DatabaseName } from '@/lib/db-manager';
import { logger } from '@/lib/logger';
import { type ServerInfo } from '@/lib/db-manager';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const databaseParam = searchParams.get('database') as DatabaseName | null;
  
  const flowName = databaseParam 
    ? `API_TEST_CONNECTION_${databaseParam.toUpperCase()}`
    : 'API_TEST_CONNECTION_ALL';
  const flowId = logger.startFlow(flowName, { database: databaseParam || 'all' });
  const flowLog = logger.createFlowLogger(flowId);

  try {
    if (databaseParam && (databaseParam === 'database_1' || databaseParam === 'database_2')) {
      // Test single database
      flowLog.info(`Testing connection for database: ${databaseParam}`);
      
      const isConnected = await testConnection(databaseParam, flowId);
      
      if (!isConnected) {
        flowLog.error(`Connection failed for: ${databaseParam}`);
        flowLog.end(false, { connected: false });
        return NextResponse.json(
          { success: false, message: `Unable to connect to database: ${databaseParam}` },
          { status: 500 }
        );
      }

      flowLog.success(`Connection test passed, fetching server info`);
      
      // Get server information
      const serverInfo = await query(databaseParam, `
        SELECT 
          @@SERVERNAME as ServerName,
          @@VERSION as Version,
          DB_NAME() as CurrentDatabase,
          SYSTEM_USER as CurrentUser
      `);

      flowLog.end(true, { 
        connected: true,
        serverInfo: serverInfo.recordset[0] 
      });

      return NextResponse.json({
        success: true,
        message: `Connection successful to ${databaseParam}!`,
        data: {
          database: databaseParam,
          connected: true,
          serverInfo: serverInfo.recordset[0],
        },
      });
    } else {
      // Test all databases
      flowLog.info('Testing connections for all databases');
      
      const results = await testAllConnections();
      
      const allConnected = Object.values(results).every(connected => connected);
      
      if (!allConnected) {
        flowLog.warn('Some database connections failed', results);
      }

      flowLog.info('Fetching server info for connected databases');
      
      // Get server info for each connected database
      const serverInfos: Record<string, ServerInfo> = {};
      
      for (const [dbName, connected] of Object.entries(results)) {
        if (connected) {
          try {
            const serverInfo = await query(dbName as DatabaseName, `
              SELECT 
                @@SERVERNAME as ServerName,
                @@VERSION as Version,
                DB_NAME() as CurrentDatabase,
                SYSTEM_USER as CurrentUser
            `);
            serverInfos[dbName] = serverInfo.recordset[0] as unknown as ServerInfo;
            flowLog.success(`Server info retrieved for ${dbName}`);
          } catch (error) {
            flowLog.error(`Error getting server info for ${dbName}`, error);
          }
        }
      }

      flowLog.end(allConnected, { 
        results,
        serverInfos 
      });

      return NextResponse.json({
        success: allConnected,
        message: allConnected 
          ? 'All database connections successful!' 
          : 'Some database connections failed',
        data: {
          connections: results,
          serverInfos,
        },
      });
    }
  } catch (error) {
    flowLog.error('Unexpected error in API test connection', error);
    flowLog.end(false, { error: error instanceof Error ? error.message : 'Unknown error' });
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: 'Database connection error',
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Import testConnection for single database test
import { testConnection } from '@/lib/db-manager';
