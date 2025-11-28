/**
 * Flow name constants for consistent logging
 */
export const FLOW_NAMES = {
  TABLE_DATA_VIEW: (database: string, schema: string, table: string) =>
    `TABLE_DATA_VIEW_${database.toUpperCase()}_${schema}_${table}`,
  
  TABLE_COMPARISON: (
    leftDb: string,
    leftSchema: string,
    leftTable: string,
    rightDb: string,
    rightSchema: string,
    rightTable: string
  ) =>
    `TABLE_COMPARISON_${leftDb.toUpperCase()}_${leftSchema}_${leftTable}_VS_${rightDb.toUpperCase()}_${rightSchema}_${rightTable}`,
  
  API_GET_TABLE_DATA: (database: string) =>
    `API_GET_TABLE_DATA_${database.toUpperCase()}`,
  
  API_GET_TABLE_RELATIONSHIPS: (database: string) =>
    `API_GET_TABLE_RELATIONSHIPS_${database.toUpperCase()}`,
  
  API_GET_TABLE_STATS: (database: string) =>
    `API_GET_TABLE_STATS_${database.toUpperCase()}`,
} as const;

