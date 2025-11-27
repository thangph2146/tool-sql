import type { ForeignKeyInfo } from '@/lib/hooks/use-database-query';

/**
 * Categorize relationships into outgoing and incoming
 */
export function categorizeRelationships(
  relationships: ForeignKeyInfo[],
  schemaName: string,
  tableName: string
) {
  const outgoing: ForeignKeyInfo[] = [];
  const incoming: ForeignKeyInfo[] = [];

  relationships.forEach((rel) => {
    const isOutgoing = rel.FK_SCHEMA === schemaName && rel.FK_TABLE === tableName;
    const isIncoming = rel.PK_SCHEMA === schemaName && rel.PK_TABLE === tableName;

    if (isOutgoing) {
      outgoing.push(rel);
    } else if (isIncoming) {
      incoming.push(rel);
    }
  });

  return { outgoing, incoming };
}

/**
 * Group relationships by target table
 */
export function groupRelationshipsByTable(
  relationships: ForeignKeyInfo[],
  isOutgoing: boolean
): Record<string, ForeignKeyInfo[]> {
  return relationships.reduce(
    (acc, rel) => {
      const key = isOutgoing
        ? `${rel.PK_SCHEMA}.${rel.PK_TABLE}`
        : `${rel.FK_SCHEMA}.${rel.FK_TABLE}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(rel);
      return acc;
    },
    {} as Record<string, ForeignKeyInfo[]>
  );
}

/**
 * Sort relationships by PK_TABLE then FK_COLUMN
 */
export function sortRelationships(relationships: ForeignKeyInfo[]): ForeignKeyInfo[] {
  return [...relationships].sort((a, b) => {
    const pkTableCompare = a.PK_TABLE.localeCompare(b.PK_TABLE, 'vi');
    if (pkTableCompare !== 0) {
      return pkTableCompare;
    }
    return a.FK_COLUMN.localeCompare(b.FK_COLUMN, 'vi');
  });
}

