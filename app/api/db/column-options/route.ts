import { NextRequest, NextResponse } from "next/server";
import type { DatabaseName } from "@/lib/db-config";
import {
  getTableDataWithConfig,
  getTableDataWithReferencesWithConfig,
} from "@/lib/db-manager";
import { logger } from "@/lib/logger";
import { getMergedConfigFromParams } from "@/lib/utils/api-config-helper";
import { DEFAULT_COLUMN_OPTIONS_LIMIT, MAX_COLUMN_OPTIONS_LIMIT, MIN_COLUMN_OPTIONS_LIMIT, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_INTERNAL_SERVER_ERROR } from "@/lib/constants/db-constants";
import {
  collectColumnUniqueValues,
  FilterRelationships,
} from "@/lib/utils/table-filter-utils";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const databaseName = searchParams.get("database") as DatabaseName | null;
  const schemaName = searchParams.get("schema");
  const tableName = searchParams.get("table");
  const columnName = searchParams.get("column");
  const includeReferences = searchParams.get("includeReferences") === "true";
  const search = searchParams.get("search") || "";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || String(DEFAULT_COLUMN_OPTIONS_LIMIT), 10), MIN_COLUMN_OPTIONS_LIMIT),
    MAX_COLUMN_OPTIONS_LIMIT
  );

  if (!databaseName || !schemaName || !tableName || !columnName) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Missing required parameters: database, schema, table, and column are required",
      },
      { status: HTTP_STATUS_BAD_REQUEST }
    );
  }

  const flowName = `API_GET_COLUMN_OPTIONS_${databaseName.toUpperCase()}`;
  const flowId = logger.startFlow(flowName, {
    database: databaseName,
    schema: schemaName,
    table: tableName,
    column: columnName,
    includeReferences,
    limit,
    search,
  });
  const flowLog = logger.createFlowLogger(flowId);

  try {
    flowLog.info("Fetching column option data");
    
    // Get merged config: customConfig || envConfig || defaults
    const customConfigParam = searchParams.get("config");
    flowLog.info(`Getting database configuration`, { 
      database: databaseName,
      hasCustomConfig: !!customConfigParam 
    });
    const dbConfig = getMergedConfigFromParams(databaseName, customConfigParam, flowLog);
    
    if (!dbConfig.enabled) {
      flowLog.error(`Database ${databaseName} is disabled`);
      flowLog.end(false, { reason: 'Database disabled' });
      return NextResponse.json(
        {
          success: false,
          message: `Database ${databaseName} is disabled`,
          error: 'Database disabled',
        },
        { status: HTTP_STATUS_BAD_REQUEST }
      );
    }

    flowLog.success(`Database ${databaseName} is enabled`);

    // Always use *WithConfig functions for consistency: customConfig || envConfig || defaults
    const tableData = includeReferences
      ? await getTableDataWithReferencesWithConfig(
          dbConfig,
          schemaName,
          tableName,
          limit,
          0,
          flowId
        )
      : await getTableDataWithConfig(
          dbConfig,
          schemaName,
          tableName,
          limit,
          0,
          flowId
        );

    const relationships: FilterRelationships[] =
      includeReferences &&
      "relationships" in tableData &&
      Array.isArray(
        (tableData as { relationships?: FilterRelationships[] }).relationships
      )
        ? ((tableData as { relationships?: FilterRelationships[] })
            .relationships ?? [])
        : [];

    let values = collectColumnUniqueValues({
      rows: tableData.rows,
      columnName,
      includeReferences,
      relationships,
    });

    // Filter values based on search term if provided
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      values = values.filter((value) =>
        value.toLowerCase().includes(searchLower)
      );
    }

    flowLog.success("Column options retrieved", {
      optionCount: values.length,
      searchTerm: search || null,
      filtered: !!search.trim(),
    });
    flowLog.end(true);

    return NextResponse.json({
      success: true,
      data: {
        values,
      },
    });
  } catch (error) {
    flowLog.error("Error fetching column options", error);
    flowLog.end(false, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch column options",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
    );
  }
}

