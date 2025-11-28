import { NextResponse } from 'next/server';
import { getTables, getTablesWithConfig, getTableStatsWithConfig, convertToSqlConfig, type DatabaseName, type TableInfo } from '@/lib/db-manager';
import { logger } from '@/lib/logger';
import { getMergedConfigFromParams } from '@/lib/utils/api-config-helper';
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_INTERNAL_SERVER_ERROR, VALID_DATABASES, TABLE_STATS_BATCH_SIZE } from '@/lib/constants/db-constants';
import sql from 'mssql';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const databaseParam = searchParams.get('database') as DatabaseName | null;
  const includeStats = searchParams.get('includeStats') === 'true';
  const filterText = searchParams.get('filterText') || '';
  const limitParam = searchParams.get('limit');
  const pageParam = searchParams.get('page');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const page = pageParam ? parseInt(pageParam, 10) : 0;
  const offset = limit !== undefined ? page * limit : undefined;

  // Single database request validation
  if (databaseParam && !VALID_DATABASES.includes(databaseParam as typeof VALID_DATABASES[number])) {
    return NextResponse.json(
      { 
        success: false, 
        message: `Invalid database parameter. Use ?database=${VALID_DATABASES.join(' or ?database=')}, or omit parameter to get all databases` 
      },
      { status: HTTP_STATUS_BAD_REQUEST }
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
    
    // Get merged config: customConfig || envConfig || defaults
    const customConfigParam = searchParams.get('config');
    flowLog.info(`Getting database configuration`, { 
      database: databaseParam,
      hasCustomConfig: !!customConfigParam 
    });
    const mergedConfig = getMergedConfigFromParams(databaseParam, customConfigParam, flowLog);
    
    // Use merged config (always use getTablesWithConfig for consistency)
    // mergedConfig = customConfig || envConfig || defaults
    flowLog.info(`Fetching tables with merged config`, {
      filterText,
      limit,
      offset,
    });
    const { tables, totalCount } = await getTablesWithConfig(mergedConfig, flowId, {
      filterText,
      limit,
      offset,
    });
    
    // If includeStats is true, fetch stats for all tables in parallel batches
    let tablesWithStats = tables;
    if (includeStats && tables.length > 0) {
      flowLog.info(`Fetching stats for ${tables.length} tables in parallel batches`);
      
      // Process in batches to avoid overwhelming the database
      const batches: TableInfo[][] = [];
      for (let i = 0; i < tables.length; i += TABLE_STATS_BATCH_SIZE) {
        batches.push(tables.slice(i, i + TABLE_STATS_BATCH_SIZE));
      }
      
      // Create a shared connection pool for each batch to optimize performance
      const allStats = await Promise.allSettled(
        batches.map(async (batch) => {
          // Create a single connection pool for this batch
          const sqlConfig = convertToSqlConfig(mergedConfig);
          let batchPool: sql.ConnectionPool | null = null;
          
          try {
            batchPool = new sql.ConnectionPool(sqlConfig);
            await batchPool.connect();
            flowLog.info(`Batch pool connected, processing ${batch.length} tables`);
            
            // Process all tables in batch using the shared pool
            const batchResults = await Promise.allSettled(
              batch.map(async (table) => {
                try {
                  const stats = await getTableStatsWithConfig(
                    mergedConfig,
                    table.TABLE_SCHEMA,
                    table.TABLE_NAME,
                    flowId,
                    batchPool || undefined
                  );
                  return {
                    ...table,
                    rowCount: stats.rowCount,
                    columnCount: stats.columnCount,
                    relationshipCount: stats.relationshipCount,
                  };
                } catch (error) {
                  // If stats fetch fails, return table without stats
                  flowLog.warn(`Failed to fetch stats for ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`, { 
                    error: error instanceof Error ? error.message : String(error) 
                  });
                  return {
                    ...table,
                    rowCount: null,
                    columnCount: null,
                    relationshipCount: null,
                  };
                }
              })
            );
            
            // Close pool after all queries complete
            if (batchPool) {
              try {
                await batchPool.close();
                batchPool = null;
              } catch (closeError) {
                flowLog.warn(`Error closing batch pool`, { error: closeError });
              }
            }
            
            return batchResults;
          } catch (error) {
            // If batch setup fails, return all tables without stats
            flowLog.error(`Batch processing failed`, { 
              error: error instanceof Error ? error.message : String(error),
              batchSize: batch.length 
            });
            
            // Close pool if it was created
            if (batchPool) {
              try {
                await batchPool.close();
              } catch {
                // Ignore close errors
              }
            }
            
            // Return all tables in batch without stats
            return batch.map((table) => ({
              status: 'fulfilled' as const,
              value: {
                ...table,
                rowCount: null,
                columnCount: null,
                relationshipCount: null,
              },
            }));
          }
        })
      );
      
      // Flatten results and preserve order
      const statsMap = new Map<string, TableInfo>();
      let successCount = 0;
      let failCount = 0;
      
      allStats.forEach((batchResult, batchIndex) => {
        if (batchResult.status === 'fulfilled') {
          batchResult.value.forEach((tableResult) => {
            if (tableResult.status === 'fulfilled') {
              const table = tableResult.value;
              const key = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
              statsMap.set(key, table);
              if (table.rowCount !== null && table.columnCount !== null && table.relationshipCount !== null) {
                successCount++;
              } else {
                failCount++;
              }
            } else {
              failCount++;
            }
          });
        } else {
          // If entire batch failed, all tables in that batch will have null stats
          const batchSize = batches[batchIndex]?.length || 0;
          failCount += batchSize;
          flowLog.error(`Batch ${batchIndex} completely failed`, { 
            error: batchResult.reason instanceof Error ? batchResult.reason.message : String(batchResult.reason),
            batchSize 
          });
        }
      });
      
      // Merge stats with original tables, preserving order
      tablesWithStats = tables.map((table) => {
        const key = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
        const tableWithStats = statsMap.get(key);
        return tableWithStats || {
          ...table,
          rowCount: null,
          columnCount: null,
          relationshipCount: null,
        };
      });
      
      flowLog.success(`Fetched stats: ${successCount} successful, ${failCount} failed out of ${tables.length} tables`);
    }
    
    flowLog.end(true, { 
      tableCount: tables.length,
      totalCount,
      includeStats,
      statsFetched: includeStats ? tablesWithStats.length : 0,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully retrieved ${tables.length} tables from ${databaseParam}${includeStats ? ' with stats' : ''}`,
      data: {
        database: databaseParam,
        tables: tablesWithStats,
        count: tables.length,
        totalCount,
        page,
        limit,
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
      { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
    );
  }
}

