import { NextRequest, NextResponse } from 'next/server';
import { getTableData, getTableDataWithReferences } from '@/lib/db-manager';
import { getDatabaseConfig } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import { filterTableRows, FilterRelationships, normalizeVietnameseText } from '@/lib/utils/table-filter-utils';
import { HIDDEN_COLUMNS, HIDDEN_COLUMN_PATTERNS } from '@/lib/constants/table-constants';

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

  // Helper function to check if a column should be hidden
  const isColumnHidden = (columnName: string): boolean => {
    // Check exact match
    for (const hiddenCol of HIDDEN_COLUMNS) {
      if (hiddenCol === columnName) {
        return true;
      }
    }
    // Check pattern match
    return HIDDEN_COLUMN_PATTERNS.some((pattern) => columnName.endsWith(pattern));
  };

  // Helper function to filter out hidden columns
  const filterHiddenColumns = (columns: string[]): string[] => {
    return columns.filter((col) => !isColumnHidden(col));
  };

  // Helper function to get first visible column for sorting
  const getFirstVisibleColumn = (columns: string[]): string | null => {
    const visibleColumns = filterHiddenColumns(columns);
    return visibleColumns.length > 0 ? visibleColumns[0] : null;
  };

  // Helper function to get Oid column for sorting (preferred)
  const getOidColumn = (columns: string[]): string | null => {
    // Tìm cột Oid trong danh sách columns (không bị ẩn)
    const oidColumn = columns.find((col) => col === 'Oid' && !isColumnHidden(col));
    return oidColumn || null;
  };

  // Helper to build normalized sort key from cell value
  const getSortKeyFromValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const raw = String(value);
    const display = raw.split(/\r?\n/)[0]?.trim() || raw.trim();
    return normalizeVietnameseText(display);
  };

  // Helper function to remove hidden column properties from rows
  const filterHiddenPropertiesFromRows = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
    return rows.map((row) => {
      const filteredRow: Record<string, unknown> = {};
      Object.keys(row).forEach((key) => {
        if (!isColumnHidden(key)) {
          filteredRow[key] = row[key];
        }
      });
      return filteredRow;
    });
  };

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
      let rows = tableData.rows;
      
      // Lọc các cột ẩn
      const visibleColumns = filterHiddenColumns(tableData.columns);
      
      // Sắp xếp rows theo bảng chữ cái (ưu tiên cột Oid, nếu không có thì dùng cột đầu tiên) chỉ khi includeReferences = true
      if (includeReferences && rows.length > 0 && visibleColumns.length > 0) {
        // Ưu tiên sắp xếp theo cột Oid, nếu không có thì dùng cột đầu tiên
        const sortColumn = getOidColumn(tableData.columns) || getFirstVisibleColumn(tableData.columns);
        if (sortColumn) {
          rows = [...rows].sort((a, b) => {
            const aValue = getSortKeyFromValue(a[sortColumn]);
            const bValue = getSortKeyFromValue(b[sortColumn]);
            return aValue.localeCompare(bValue, 'vi');
          });
        }
      }
      
      // Loại bỏ các properties ẩn khỏi rows
      rows = filterHiddenPropertiesFromRows(rows);
      
      const filteredRowCount = rows.length;
      const relationshipCount = relationships.length;

      flowLog.success(`Data fetched successfully`, {
        rowsReturned: rows.length,
        totalRows: tableData.totalRows,
        columns: visibleColumns.length,
        relationshipCount,
      });

      flowLog.end(true, {
        rowsReturned: rows.length,
        totalRows: tableData.totalRows,
        columns: visibleColumns.length,
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
          columns: visibleColumns,
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

    // Lọc các cột ẩn
    const visibleColumns = filterHiddenColumns(columns);

    // Sắp xếp paginatedRows theo bảng chữ cái (ưu tiên cột Oid, nếu không có thì dùng cột đầu tiên) chỉ khi includeReferences = true
    let sortedRows = paginatedRows;
    if (includeReferences && sortedRows.length > 0 && visibleColumns.length > 0) {
      // Ưu tiên sắp xếp theo cột Oid, nếu không có thì dùng cột đầu tiên
      const sortColumn = getOidColumn(columns) || getFirstVisibleColumn(columns);
      if (sortColumn) {
        sortedRows = [...sortedRows].sort((a, b) => {
          const aValue = getSortKeyFromValue(a[sortColumn]);
          const bValue = getSortKeyFromValue(b[sortColumn]);
          return aValue.localeCompare(bValue, 'vi');
        });
      }
    }

    // Loại bỏ các properties ẩn khỏi rows
    sortedRows = filterHiddenPropertiesFromRows(sortedRows);

    flowLog.success('Filtered data prepared', {
      filteredRowCount,
      rowsReturned: sortedRows.length,
      totalRows,
      chunkSize,
      chunksProcessed: chunkIndex,
      relationshipCount,
    });

    flowLog.end(true, {
      rowsReturned: sortedRows.length,
      totalRows,
      columns: visibleColumns.length,
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
        columns: visibleColumns,
        rows: sortedRows,
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

