/**
 * Custom hook for creating and managing joined data maps
 * Handles data from joined tables for cross-table column joins
 */

import { useMemo } from 'react';
import { useTableData } from '@/lib/hooks/use-database-query';
import type { DatabaseName } from '@/lib/db-config';
import type { CombinedColumn } from '@/components/database/comparison/column-selector';

interface TableInfo {
  databaseName: DatabaseName;
  schemaName: string;
  tableName: string;
}

interface UseJoinedDataMapsProps {
  leftTable: TableInfo;
  rightTable: TableInfo;
  leftTableData?: {
    rows: Record<string, unknown>[];
    columns: string[];
  };
  rightTableData?: {
    rows: Record<string, unknown>[];
    columns: string[];
  };
  validatedCombinedColumns: CombinedColumn[];
  leftLimit: number;
  rightLimit: number;
  open: boolean;
}

export function useJoinedDataMaps({
  leftTable,
  rightTable,
  leftTableData,
  rightTableData,
  validatedCombinedColumns,
  leftLimit,
  rightLimit,
  open,
}: UseJoinedDataMapsProps) {
  // Helper function to create joinedDataMap from table data
  const createJoinedDataMap = (rows: Record<string, unknown>[]): Map<string, Record<string, unknown>> => {
    const map = new Map<string, Record<string, unknown>>();
    rows.forEach(row => {
      // Store with Oid as primary key
      const oidKey = String(row["Oid"] ?? "");
      if (oidKey) {
        map.set(oidKey, row);
      }
      // Also store with other common key columns
      Object.keys(row).forEach(col => {
        const value = row[col];
        if (value !== null && value !== undefined && value !== "") {
          const key = `${col}:${String(value).trim()}`;
          if (!map.has(key)) {
            map.set(key, row);
          }
        }
      });
    });
    return map;
  };

  // Create joined data maps for left and right tables
  const leftRows = leftTableData?.rows;
  const rightRows = rightTableData?.rows;
  
  const leftJoinedDataMap = useMemo(() => {
    if (!leftRows) return new Map<string, Record<string, unknown>>();
    return createJoinedDataMap(leftRows);
  }, [leftRows]);

  const rightJoinedDataMap = useMemo(() => {
    if (!rightRows) return new Map<string, Record<string, unknown>>();
    return createJoinedDataMap(rightRows);
  }, [rightRows]);

  // Get all unique tables that are being joined (from combinedColumns)
  const joinedTables = useMemo(() => {
    const tables = new Map<string, { schema: string; table: string; database: DatabaseName }>();
    
    validatedCombinedColumns.forEach(combined => {
      if (combined.joinTable) {
        const rel = combined.joinTable.relationship;
        // Determine which table is being joined
        const currentTableIsFK = (combined.side === "left" && rel.FK_SCHEMA === leftTable.schemaName && rel.FK_TABLE === leftTable.tableName) ||
                                 (combined.side === "right" && rel.FK_SCHEMA === rightTable.schemaName && rel.FK_TABLE === rightTable.tableName);
        
        if (currentTableIsFK) {
          // Join from PK table
          const key = `${rel.PK_SCHEMA}.${rel.PK_TABLE}`;
          if (!tables.has(key)) {
            tables.set(key, {
              schema: rel.PK_SCHEMA,
              table: rel.PK_TABLE,
              database: combined.side === "left" ? leftTable.databaseName : rightTable.databaseName,
            });
          }
        } else {
          // Join from FK table
          const key = `${rel.FK_SCHEMA}.${rel.FK_TABLE}`;
          if (!tables.has(key)) {
            tables.set(key, {
              schema: rel.FK_SCHEMA,
              table: rel.FK_TABLE,
              database: combined.side === "left" ? leftTable.databaseName : rightTable.databaseName,
            });
          }
        }
      }
    });
    
    return Array.from(tables.values());
  }, [validatedCombinedColumns, leftTable, rightTable]);

  // Filter out tables that are already left/right tables
  const joinedTablesToFetch = useMemo(() => {
    return joinedTables.filter(tableInfo => {
      const isLeftTable = tableInfo.schema === leftTable.schemaName && tableInfo.table === leftTable.tableName;
      const isRightTable = tableInfo.schema === rightTable.schemaName && tableInfo.table === rightTable.tableName;
      return !isLeftTable && !isRightTable;
    });
  }, [joinedTables, leftTable, rightTable]);

  // Fetch data for the first joined table (support only one for now due to React hooks rules)
  const firstJoinedTable = joinedTablesToFetch[0];
  
  // Fetch rows from joined table - use max of leftLimit and rightLimit
  const joinedTableFetchLimit = useMemo(() => {
    return Math.max(leftLimit, rightLimit, 100);
  }, [leftLimit, rightLimit]);
  
  const joinedTableData = useTableData(
    firstJoinedTable?.database,
    firstJoinedTable?.schema,
    firstJoinedTable?.table,
    joinedTableFetchLimit,
    0,
    open && !!firstJoinedTable,
    false
  );

  // Create a map of table keys to their joinedDataMap
  const allJoinedDataMaps = useMemo(() => {
    const maps = new Map<string, Map<string, Record<string, unknown>>>();
    
    // Add left and right table maps
    maps.set(`${leftTable.schemaName}.${leftTable.tableName}`, leftJoinedDataMap);
    maps.set(`${rightTable.schemaName}.${rightTable.tableName}`, rightJoinedDataMap);
    
    // Add joined table maps
    if (firstJoinedTable && joinedTableData?.data?.data?.rows) {
      const tableKey = `${firstJoinedTable.schema}.${firstJoinedTable.table}`;
      const joinedMap = createJoinedDataMap(joinedTableData.data.data.rows);
      maps.set(tableKey, joinedMap);
    }
    
    return maps;
  }, [leftJoinedDataMap, rightJoinedDataMap, leftTable, rightTable, firstJoinedTable, joinedTableData]);

  return {
    leftJoinedDataMap,
    rightJoinedDataMap,
    allJoinedDataMaps,
    joinedTables,
    firstJoinedTable,
    joinedTableData,
  };
}

