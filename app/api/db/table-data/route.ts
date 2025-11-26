import { NextRequest, NextResponse } from 'next/server';
import { getTableData, getTableDataWithReferences } from '@/lib/db-manager';
import { getDatabaseConfig } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import { filterTableRows, FilterRelationships } from '@/lib/utils/table-filter-utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const databaseName = searchParams.get('database') as DatabaseName;
  const schemaName = searchParams.get('schema');
  const tableName = searchParams.get('table');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const includeReferences = searchParams.get('includeReferences') === 'true';
  const filtersParam = searchParams.get('filters');
  let filters: Record<string, string> = {};

  if (filtersParam) {
    try {
      const parsed = JSON.parse(filtersParam);
      if (parsed && typeof parsed === 'object') {
        filters = Object.fromEntries(
          Object.entries(parsed)
            .filter(([, value]) => typeof value === 'string')
            .map(([key, value]) => [key, (value as string).trim()])
            .filter(([, value]) => value.length > 0)
        );
      }
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid filters parameter. Must be valid JSON object.',
          error: parseError instanceof Error ? parseError.message : 'Invalid filters',
        },
        { status: 400 }
      );
    }
  }

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

  const flowName = `API_GET_TABLE_DATA_${databaseName.toUpperCase()}`;
  const flowId = logger.startFlow(flowName, {
    database: databaseName,
    schema: schemaName,
    table: tableName,
    limit,
    offset,
    includeReferences,
    filters,
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

    const hasActiveFilters = Object.keys(filters).length > 0;

    const extractRelationships = (data: {
      relationships?: FilterRelationships[];
    }): FilterRelationships[] =>
      includeReferences &&
      'relationships' in data &&
      Array.isArray(data.relationships)
        ? data.relationships ?? []
        : [];

    if (!hasActiveFilters) {
      flowLog.info(`Fetching paginated table data (includeReferences: ${includeReferences})`);

      const tableData = includeReferences
        ? await getTableDataWithReferences(
            databaseName,
            schemaName,
            tableName,
            limit,
            offset,
            flowId
          )
        : await getTableData(
            databaseName,
            schemaName,
            tableName,
            limit,
            offset,
            flowId
          );

      const relationships = extractRelationships(tableData as { relationships?: FilterRelationships[] });
      const rows = tableData.rows;
      const filteredRowCount = rows.length;
      const relationshipCount = relationships.length;

      flowLog.success(`Data fetched successfully`, {
        rowsReturned: rows.length,
        totalRows: tableData.totalRows,
        columns: tableData.columns.length,
        relationshipCount,
      });

      flowLog.end(true, {
        rowsReturned: rows.length,
        totalRows: tableData.totalRows,
        columns: tableData.columns.length,
        filteredRowCount,
        filtersApplied: {},
        includeReferences,
        relationshipCount,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully fetched data from ${schemaName}.${tableName}`,
        data: {
          database: databaseName,
          schema: schemaName,
          table: tableName,
          columns: tableData.columns,
          rows,
          totalRows: tableData.totalRows,
          hasMore: tableData.hasMore,
          limit,
          offset,
          filteredRowCount,
          filtersApplied: {},
          ...(includeReferences && relationships.length > 0 ? { relationships } : {}),
        },
      });
    }

    // Active filters path – stream the table in chunks so that filtering happens on the full dataset
    const MIN_CHUNK_SIZE = 500;
    const MAX_CHUNK_SIZE = 5000;
    const chunkSize = Math.min(Math.max(limit, MIN_CHUNK_SIZE), MAX_CHUNK_SIZE);

    flowLog.info('Active filters detected – streaming table rows for server-side filtering', {
      chunkSize,
      filters,
    });

    let chunkOffset = 0;
    let totalRows = 0;
    let columns: string[] = [];
    let relationships: FilterRelationships[] = [];
    const paginatedRows: Record<string, unknown>[] = [];
    let filteredRowCount = 0;
    let chunkIndex = 0;

    while (true) {
      const chunkLimit = chunkSize;
      const chunkData = includeReferences
        ? await getTableDataWithReferences(
            databaseName,
            schemaName,
            tableName,
            chunkLimit,
            chunkOffset,
            flowId
          )
        : await getTableData(
            databaseName,
            schemaName,
            tableName,
            chunkLimit,
            chunkOffset,
            flowId
          );

      chunkIndex += 1;

      if (chunkIndex === 1) {
        columns = chunkData.columns;
        totalRows = chunkData.totalRows;
        relationships = extractRelationships(chunkData as { relationships?: FilterRelationships[] });
      }

      const chunkFilteredRows = filterTableRows(chunkData.rows, filters, {
        includeReferences,
        relationships,
      });

      chunkFilteredRows.forEach((row) => {
        filteredRowCount += 1;
        if (filteredRowCount > offset && paginatedRows.length < limit) {
          paginatedRows.push(row);
        }
      });

      if (!chunkData.hasMore || chunkData.rows.length === 0) {
        break;
      }

      chunkOffset += chunkLimit;
    }

    const filteredHasMore = filteredRowCount > offset + paginatedRows.length;
    const relationshipCount = relationships.length;

    flowLog.success('Filtered data prepared', {
      filteredRowCount,
      rowsReturned: paginatedRows.length,
      totalRows,
      chunkSize,
      chunksProcessed: chunkIndex,
      relationshipCount,
    });

    flowLog.end(true, {
      rowsReturned: paginatedRows.length,
      totalRows,
      columns: columns.length,
      filteredRowCount,
      filtersApplied: filters,
      includeReferences,
      relationshipCount,
      chunkSize,
      chunksProcessed: chunkIndex,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully fetched data from ${schemaName}.${tableName}`,
      data: {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        columns,
        rows: paginatedRows,
        totalRows,
        hasMore: filteredHasMore,
        limit,
        offset,
        filteredRowCount,
        filtersApplied: filters,
        ...(includeReferences && relationships.length > 0 ? { relationships } : {}),
      },
    });
  } catch (error) {
    flowLog.error('Unexpected error in API get table data', error);
    flowLog.end(false, { error: error instanceof Error ? error.message : 'Unknown error' });

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

