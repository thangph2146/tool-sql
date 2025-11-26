import { NextRequest, NextResponse } from "next/server";
import type { DatabaseName } from "@/lib/db-config";
import {
  getTableData,
  getTableDataWithReferences,
} from "@/lib/db-manager";
import { logger } from "@/lib/logger";
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
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "500", 10), 1),
    2000
  );

  if (!databaseName || !schemaName || !tableName || !columnName) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Missing required parameters: database, schema, table, and column are required",
      },
      { status: 400 }
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
  });
  const flowLog = logger.createFlowLogger(flowId);

  try {
    flowLog.info("Fetching column option data");

    const tableData = includeReferences
      ? await getTableDataWithReferences(
          databaseName,
          schemaName,
          tableName,
          limit,
          0,
          flowId
        )
      : await getTableData(
          databaseName,
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

    const values = collectColumnUniqueValues({
      rows: tableData.rows,
      columnName,
      includeReferences,
      relationships,
    });

    flowLog.success("Column options retrieved", {
      optionCount: values.length,
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
      { status: 500 }
    );
  }
}

