import { NextRequest } from 'next/server';
import { getTableForeignKeys, getTableReferencedBy } from '@/lib/db-manager';
import { getDatabaseConfig } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';
import { FLOW_NAMES } from '@/lib/constants/flow-constants';
import { sortRelationships } from '@/lib/utils/relationship-utils';
import { errorResponse, successResponse, validateRequiredParams } from '@/lib/utils/api-response';

const VALID_DATABASES: DatabaseName[] = ['database_1', 'database_2'];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const databaseName = searchParams.get('database') as DatabaseName;
  const schemaName = searchParams.get('schema');
  const tableName = searchParams.get('table');

  // Validate required parameters
  const validation = validateRequiredParams(
    { database: databaseName, schema: schemaName, table: tableName },
    ['database', 'schema', 'table']
  );

  if (!validation.valid) {
    return errorResponse(
      `Missing required parameters: ${validation.missing.join(', ')}`,
      'Missing parameters'
    );
  }

  // Validate database name
  if (!VALID_DATABASES.includes(databaseName)) {
    return errorResponse(
      `Invalid database name: ${databaseName}. Must be one of: ${VALID_DATABASES.join(', ')}`,
      'Invalid database name'
    );
  }

  const flowName = FLOW_NAMES.API_GET_TABLE_RELATIONSHIPS(databaseName);
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
      return errorResponse(
        `Database ${databaseName} is disabled`,
        'Database disabled'
      );
    }

    flowLog.success(`Database ${databaseName} is enabled`);
    flowLog.info(`Fetching foreign key relationships for ${schemaName}.${tableName}`);

    // Fetch outgoing foreign keys (FK từ table hiện tại đi ra)
    const outgoingForeignKeys = await getTableForeignKeys(
      databaseName,
      schemaName!,
      tableName!,
      flowId
    );

    // Fetch incoming foreign keys (FK từ các table khác trỏ vào table hiện tại)
    const incomingForeignKeys = await getTableReferencedBy(
      databaseName,
      schemaName!,
      tableName!,
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
    const sortedRelationships = sortRelationships(allRelationships);

    const summary = {
      outgoingCount: outgoingForeignKeys.length,
      incomingCount: incomingForeignKeys.length,
      totalCount: sortedRelationships.length,
    };

    flowLog.success('Relationships fetched successfully', summary);
    flowLog.end(true, summary);

    return successResponse(
      `Successfully fetched relationships for ${schemaName}.${tableName}`,
      {
        database: databaseName,
        schema: schemaName,
        table: tableName,
        relationships: sortedRelationships,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    flowLog.error('Unexpected error in API get table relationships', error);
    flowLog.end(false, { error: errorMessage });

    return errorResponse('Failed to fetch table relationships', errorMessage, 500);
  }
}

