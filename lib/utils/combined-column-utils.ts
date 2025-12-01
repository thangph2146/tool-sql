/**
 * Utility functions for handling combined columns in table comparison
 */

import type { CombinedColumn } from "@/components/database/comparison/column-selector";

/**
 * Extracts Oid from display value with format "Name\n(ID: Oid)" or "Name (ID: Oid)"
 * Returns the Oid part, or the original value if no ID pattern is found
 */
function extractOidFromDisplayValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value !== "string") {
    return value;
  }
  
  const strValue = value;
  
  // Try to extract Oid from pattern "\n(ID: Oid)" or "(ID: Oid)"
  const idPattern = /\(ID:\s*([^)]+)\)/;
  const match = strValue.match(idPattern);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // If no pattern found, return original value
  return value;
}

/**
 * Gets the actual value for a column (original, combined, or joined from other table)
 */
export function getColumnValue(
  row: Record<string, unknown>,
  columnName: string,
  combinedColumns: CombinedColumn[],
  joinedDataMap?: Map<string, Record<string, unknown>>, // Map of join key to joined row data (deprecated, use allJoinedDataMaps)
  allJoinedDataMaps?: Map<string, Map<string, Record<string, unknown>>>, // Map of table keys to their joinedDataMap
  currentTableInfo?: { schemaName: string; tableName: string } // For determining which joinedDataMap to use
): unknown {
  // Check if this is a combined column
  const combined = combinedColumns.find((col) => col.name === columnName);
  if (combined) {
    // Check if this is a joined column from other table
    // First try to use allJoinedDataMaps (new way), fallback to joinedDataMap (old way)
    let effectiveJoinedDataMap: Map<string, Record<string, unknown>> | undefined;
    
    if (combined.joinTable && allJoinedDataMaps && currentTableInfo) {
      // Use allJoinedDataMaps to get the correct joinedDataMap for this table
      const rel = combined.joinTable.relationship;
      // Determine which table is being joined
      // Current table can be either FK side or PK side
      const currentTableIsFK = rel.FK_SCHEMA === currentTableInfo.schemaName && rel.FK_TABLE === currentTableInfo.tableName;
      const currentTableIsPK = rel.PK_SCHEMA === currentTableInfo.schemaName && rel.PK_TABLE === currentTableInfo.tableName;
      
      let joinedTableKey: string;
      if (currentTableIsFK) {
        // Current table is FK side, so join from PK table
        joinedTableKey = `${rel.PK_SCHEMA}.${rel.PK_TABLE}`;
      } else if (currentTableIsPK) {
        // Current table is PK side, so join from FK table
        joinedTableKey = `${rel.FK_SCHEMA}.${rel.FK_TABLE}`;
      } else {
        // Current table is neither FK nor PK - this shouldn't happen, but try both
        // Try PK table first (most common case)
        joinedTableKey = `${rel.PK_SCHEMA}.${rel.PK_TABLE}`;
      }
      
      effectiveJoinedDataMap = allJoinedDataMaps.get(joinedTableKey);
      
      // If not found, try the other side
      if (!effectiveJoinedDataMap) {
        const alternativeKey = currentTableIsFK 
          ? `${rel.FK_SCHEMA}.${rel.FK_TABLE}`
          : `${rel.PK_SCHEMA}.${rel.PK_TABLE}`;
        effectiveJoinedDataMap = allJoinedDataMaps.get(alternativeKey);
      }
    } else if (combined.joinTable && joinedDataMap) {
      // Fallback to old joinedDataMap
      effectiveJoinedDataMap = joinedDataMap;
    }
    
    if (combined.joinTable && effectiveJoinedDataMap) {
      const { relationship, joinColumn } = combined.joinTable;
      
      // Determine which column to use for join based on relationship direction
      // If current table is FK side, use FK_COLUMN to match with PK_COLUMN in other table
      // If current table is PK side, use PK_COLUMN to match with FK_COLUMN in other table
      let joinKey: unknown = null;
      let targetColumn: string | undefined;
      
      // Try to determine which side current table is on
      // Check if FK_COLUMN exists in row (current table is FK side)
      if (relationship.FK_COLUMN in row && row[relationship.FK_COLUMN] !== null && row[relationship.FK_COLUMN] !== undefined) {
        // Current table is FK side, join using FK_COLUMN to match PK_COLUMN in other table
        joinKey = row[relationship.FK_COLUMN];
        targetColumn = relationship.PK_COLUMN;
      } 
      // Check if PK_COLUMN exists in row (current table is PK side)
      else if (relationship.PK_COLUMN in row && row[relationship.PK_COLUMN] !== null && row[relationship.PK_COLUMN] !== undefined) {
        // Current table is PK side, join using PK_COLUMN to match FK_COLUMN in other table
        joinKey = row[relationship.PK_COLUMN];
        targetColumn = relationship.FK_COLUMN;
      }
      // If neither exists, try to use currentTableInfo to determine
      else if (currentTableInfo) {
        const currentTableIsFK = relationship.FK_SCHEMA === currentTableInfo.schemaName && relationship.FK_TABLE === currentTableInfo.tableName;
        if (currentTableIsFK && relationship.FK_COLUMN in row) {
          joinKey = row[relationship.FK_COLUMN];
          targetColumn = relationship.PK_COLUMN;
        } else if (!currentTableIsFK && relationship.PK_COLUMN in row) {
          joinKey = row[relationship.PK_COLUMN];
          targetColumn = relationship.FK_COLUMN;
        }
      }
      
      if (joinKey !== null && joinKey !== undefined && targetColumn) {
        // Extract Oid from display value if it's in format "Name\n(ID: Oid)"
        // This handles cases where FK/PK columns contain display values instead of raw Oids
        const extractedOid = extractOidFromDisplayValue(joinKey);
        const normalizedKey = String(extractedOid).trim();
        const originalKey = String(joinKey).trim();
        
        // Try multiple lookup strategies:
        // 1. Try with extracted Oid using targetColumn:value format
        const targetColumnKey = `${targetColumn}:${normalizedKey}`;
        let joinedRow = effectiveJoinedDataMap.get(targetColumnKey);
        
        // 2. Try direct Oid lookup (for Oid columns)
        if (!joinedRow) {
          joinedRow = effectiveJoinedDataMap.get(normalizedKey);
        }
        
        // 3. Try with original key (in case it's already a raw Oid)
        if (!joinedRow && originalKey !== normalizedKey) {
          const originalTargetColumnKey = `${targetColumn}:${originalKey}`;
          joinedRow = effectiveJoinedDataMap.get(originalTargetColumnKey);
          if (!joinedRow) {
            joinedRow = effectiveJoinedDataMap.get(originalKey);
          }
        }
        
        // 4. If still not found, search all values by targetColumn
        // This is a fallback that searches through all rows
        if (!joinedRow) {
          joinedRow = Array.from(effectiveJoinedDataMap.values()).find(
            (joinedRow) => {
              const targetValue = joinedRow[targetColumn];
              if (targetValue === null || targetValue === undefined) return false;
              // Compare values (handle string/number conversion)
              const normalizedTarget = String(targetValue).trim();
              // Try multiple comparison strategies
              return normalizedTarget === normalizedKey || 
                     normalizedTarget === originalKey ||
                     String(targetValue) === String(joinKey) ||
                     String(targetValue) === String(extractedOid) ||
                     targetValue === joinKey ||
                     targetValue === extractedOid;
            }
          );
        }
        
        if (joinedRow && joinColumn in joinedRow) {
          return joinedRow[joinColumn];
        }
      }
      return null; // No match found
    }
    
    // Regular combined column - combine values from source columns
    const values = combined.sourceColumns.map((sourceCol) => row[sourceCol]);
    // Join with space, filter out null/undefined
    return values
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => String(v))
      .join(" ");
  }
  
  // Return original column value
  return row[columnName];
}

/**
 * Creates a mapping from display column names to original column names
 * This ensures backward compatibility
 */
export function createColumnMapping(
  columns: string[],
  combinedColumns: CombinedColumn[]
): Map<string, string[]> {
  const mapping = new Map<string, string[]>();
  
  // Map original columns to themselves
  columns.forEach((col) => {
    mapping.set(col, [col]);
  });
  
  // Map combined columns to their source columns
  combinedColumns.forEach((combined) => {
    mapping.set(combined.name, combined.sourceColumns);
  });
  
  return mapping;
}

/**
 * Validates that combined columns have valid source columns in the table
 */
export function validateCombinedColumns(
  combinedColumns: CombinedColumn[],
  availableColumns: string[]
): {
  valid: CombinedColumn[];
  invalid: CombinedColumn[];
} {
  const valid: CombinedColumn[] = [];
  const invalid: CombinedColumn[] = [];
  
  combinedColumns.forEach((combined) => {
    const allSourcesExist = combined.sourceColumns.every((source) =>
      availableColumns.includes(source)
    );
    
    if (allSourcesExist) {
      valid.push(combined);
    } else {
      invalid.push(combined);
    }
  });
  
  return { valid, invalid };
}

/**
 * Gets all columns (original + combined) for a side
 */
export function getAllColumnsForSide(
  originalColumns: string[],
  combinedColumns: CombinedColumn[],
  side: "left" | "right"
): string[] {
  const sideCombined = combinedColumns
    .filter((col) => col.side === side)
    .map((col) => col.name);
  
  return [...originalColumns, ...sideCombined];
}

