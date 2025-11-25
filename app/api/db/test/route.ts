import { NextResponse } from 'next/server';
import { testAllConnections, query, type DatabaseName } from '@/lib/db-manager';
import { logger } from '@/lib/logger';
import { type ServerInfo } from '@/lib/db-manager';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const databaseParam = searchParams.get('database') as DatabaseName | null;

    if (databaseParam && (databaseParam === 'PSC_HRM' || databaseParam === 'HRM_HUB')) {
      // Test single database
      logger.info(`API test connection called for database: ${databaseParam}`, undefined, 'API_DB_TEST');
      
      const isConnected = await testConnection(databaseParam);
      
      if (!isConnected) {
        logger.warn(`Database connection failed for: ${databaseParam}`, undefined, 'API_DB_TEST');
        return NextResponse.json(
          { success: false, message: `Unable to connect to database: ${databaseParam}` },
          { status: 500 }
        );
      }

      // Get server information
      const serverInfo = await query(databaseParam, `
        SELECT 
          @@SERVERNAME as ServerName,
          @@VERSION as Version,
          DB_NAME() as CurrentDatabase,
          SYSTEM_USER as CurrentUser
      `);

      logger.success(`API test connection successful for database: ${databaseParam}`, { 
        serverInfo: serverInfo.recordset[0] 
      }, 'API_DB_TEST');

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
      logger.info('API test connection called for all databases', undefined, 'API_DB_TEST');
      
      const results = await testAllConnections();
      
      const allConnected = Object.values(results).every(connected => connected);
      
      if (!allConnected) {
        logger.warn('Some database connections failed', results, 'API_DB_TEST');
      }

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
          } catch (error) {
            logger.error(`Error getting server info for ${dbName}`, error, 'API_DB_TEST');
          }
        }
      }

      logger.success('API test connection completed for all databases', { 
        results,
        serverInfos 
      }, 'API_DB_TEST');

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
    logger.error('Error in API test connection', error, 'API_DB_TEST');
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
