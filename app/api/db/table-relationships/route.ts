import { NextRequest, NextResponse } from 'next/server';
import { getTableForeignKeys, getTableReferencedBy } from '@/lib/db-manager';
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

    // Fetch outgoing foreign keys (FK từ table hiện tại đi ra)
    const outgoingForeignKeys = await getTableForeignKeys(
      databaseName,
      schemaName,
      tableName,
      flowId
    );

    // Fetch incoming foreign keys (FK từ các table khác trỏ vào table hiện tại)
    const incomingForeignKeys = await getTableReferencedBy(
      databaseName,
      schemaName,
      tableName,
      flowId
    );

    // Gộp cả hai loại relationships và loại bỏ duplicate
    // Sử dụng Map với key là combination của các trường để đảm bảo unique
    const relationshipsMap = new Map<string, typeof outgoingForeignKeys[0]>();
    
    // Thêm outgoing relationships
    outgoingForeignKeys.forEach((rel) => {
      const key = `${rel.FK_NAME}||${rel.FK_SCHEMA}.${rel.FK_TABLE}.${rel.FK_COLUMN}||${rel.PK_SCHEMA}.${rel.PK_TABLE}.${rel.PK_COLUMN}`;
      if (!relationshipsMap.has(key)) {
        relationshipsMap.set(key, rel);
      }
    });
    
    // Thêm incoming relationships (có thể trùng với outgoing nếu có self-reference)
    incomingForeignKeys.forEach((rel) => {
      const key = `${rel.FK_NAME}||${rel.FK_SCHEMA}.${rel.FK_TABLE}.${rel.FK_COLUMN}||${rel.PK_SCHEMA}.${rel.PK_TABLE}.${rel.PK_COLUMN}`;
      if (!relationshipsMap.has(key)) {
        relationshipsMap.set(key, rel);
      }
    });
    
    const allRelationships = Array.from(relationshipsMap.values());

    // Sắp xếp relationships: nhóm theo PK_TABLE (Table Relationships) trước, sau đó theo FK_COLUMN
    const sortedRelationships = [...allRelationships].sort((a, b) => {
      // So sánh theo PK_TABLE trước (Table Relationships)
      const pkTableCompare = a.PK_TABLE.localeCompare(b.PK_TABLE, 'vi');
      if (pkTableCompare !== 0) {
        return pkTableCompare;
      }
      // Nếu PK_TABLE giống nhau, sắp xếp theo FK_COLUMN
      return a.FK_COLUMN.localeCompare(b.FK_COLUMN, 'vi');
    });

    flowLog.success(`Relationships fetched successfully`, {
      outgoingCount: outgoingForeignKeys.length,
      incomingCount: incomingForeignKeys.length,
      totalCount: sortedRelationships.length,
    });

    flowLog.end(true, {
      outgoingCount: outgoingForeignKeys.length,
      incomingCount: incomingForeignKeys.length,
      totalCount: sortedRelationships.length,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully fetched relationships for ${schemaName}.${tableName}`,
      data: {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        relationships: sortedRelationships,
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

