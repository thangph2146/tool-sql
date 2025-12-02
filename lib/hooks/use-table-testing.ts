import { useState, useCallback, useEffect } from 'react';
import { useTestTable } from '@/lib/hooks/use-database-query';
import type { DatabaseName } from '@/lib/db-config';
import { logger } from '@/lib/logger';

interface UseTableTestingReturn {
  tableStatuses: Map<string, 'idle' | 'testing' | 'success' | 'error'>;
  errorTables: Set<string>;
  testingTables: Set<string>;
  testTable: (schema: string, table: string) => void;
  testAllTables: (tables: Array<{ TABLE_SCHEMA: string; TABLE_NAME: string }>) => void;
  hasTableError: (schema: string, table: string) => boolean;
  setTableStatus: (schema: string, table: string, status: 'idle' | 'testing' | 'success' | 'error') => void;
  setErrorTable: (schema: string, table: string, hasError: boolean) => void;
  setTestingTable: (schema: string, table: string, isTesting: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useTableTesting(_databaseName: DatabaseName): UseTableTestingReturn {
  // Note: databaseName is kept for future scoping of table statuses per database
  // Currently, table keys are scoped by schema.table only
  const [tableStatuses, setTableStatuses] = useState<
    Map<string, 'idle' | 'testing' | 'success' | 'error'>
  >(new Map());
  const [errorTables, setErrorTables] = useState<Set<string>>(new Set());
  const [testingTables, setTestingTables] = useState<Set<string>>(new Set());

  const testTable = useCallback(
    (schema: string, table: string) => {
      const tableKey = `${schema}.${table}`;
      if (testingTables.has(tableKey)) return; // Already testing

      setTestingTables((prev) => new Set(prev).add(tableKey));
      setTableStatuses((prev) => {
        const newMap = new Map(prev);
        newMap.set(tableKey, 'testing');
        return newMap;
      });
    },
    [testingTables]
  );

  const testAllTables = useCallback(
    (tables: Array<{ TABLE_SCHEMA: string; TABLE_NAME: string }>) => {
      tables.forEach((table) => {
        testTable(table.TABLE_SCHEMA, table.TABLE_NAME);
      });
    },
    [testTable]
  );

  const hasTableError = useCallback(
    (schema: string, table: string) => {
      const tableKey = `${schema}.${table}`;
      return errorTables.has(tableKey);
    },
    [errorTables]
  );

  const setTableStatus = useCallback(
    (schema: string, table: string, status: 'idle' | 'testing' | 'success' | 'error') => {
      const tableKey = `${schema}.${table}`;
      setTableStatuses((prev) => {
        if (prev.get(tableKey) === status) return prev;
        const newMap = new Map(prev);
        newMap.set(tableKey, status);
        return newMap;
      });
    },
    []
  );

  const setErrorTable = useCallback(
    (schema: string, table: string, hasError: boolean) => {
      const tableKey = `${schema}.${table}`;
      setErrorTables((prev) => {
        if (hasError && prev.has(tableKey)) return prev;
        if (!hasError && !prev.has(tableKey)) return prev;
        const newSet = new Set(prev);
        if (hasError) {
          newSet.add(tableKey);
        } else {
          newSet.delete(tableKey);
        }
        return newSet;
      });
    },
    []
  );

  const setTestingTable = useCallback(
    (schema: string, table: string, isTesting: boolean) => {
      const tableKey = `${schema}.${table}`;
      setTestingTables((prev) => {
        if (isTesting && prev.has(tableKey)) return prev;
        if (!isTesting && !prev.has(tableKey)) return prev;
        const newSet = new Set(prev);
        if (isTesting) {
          newSet.add(tableKey);
        } else {
          newSet.delete(tableKey);
        }
        return newSet;
      });
    },
    []
  );

  return {
    tableStatuses,
    errorTables,
    testingTables,
    testTable,
    testAllTables,
    hasTableError,
    setTableStatus,
    setErrorTable,
    setTestingTable,
  };
}

interface UseTableTestResultProps {
  databaseName: DatabaseName;
  schema: string;
  table: string;
  shouldTest: boolean;
  onStatusChange: (status: 'idle' | 'testing' | 'success' | 'error') => void;
  onErrorChange: (hasError: boolean) => void;
  onTestingChange: (isTesting: boolean) => void;
  onStatsUpdate?: (stats: { columnCount: number }) => void;
}

export function useTableTestResult({
  databaseName,
  schema,
  table,
  shouldTest,
  onStatusChange,
  onErrorChange,
  onTestingChange,
  onStatsUpdate,
}: UseTableTestResultProps) {
  const { data, error, isLoading } = useTestTable(databaseName, schema, table, shouldTest);

  useEffect(() => {
    if (!shouldTest) return;

    if (error) {
      onStatusChange('error');
      onErrorChange(true);
      onTestingChange(false);
    } else if (data && !isLoading) {
      // API response structure: { success: true, data: { accessible: true, ... } }
      // Check both success flag and accessible flag
      const isAccessible = data.success === true && data.data?.accessible === true;
      const newStatus = isAccessible ? 'success' : 'error';
      
      logger.debug(
        'Table test result',
        {
          database: databaseName,
          schema,
          table,
          success: data.success,
          accessible: data.data?.accessible,
          isAccessible,
          newStatus,
          columnsCount: data.data?.columnsCount,
        },
        'TABLE_TEST'
      );
      
      onStatusChange(newStatus);
      // Clear error if accessible, set error if not accessible
      onErrorChange(!isAccessible);
      onTestingChange(false);
      
      // Update stats if columnsCount is available from test response
      if (isAccessible && data.data?.columnsCount !== undefined && data.data.columnsCount > 0 && onStatsUpdate) {
        onStatsUpdate({ columnCount: data.data.columnsCount });
      }
    }
  }, [data, error, isLoading, shouldTest, onStatusChange, onErrorChange, onTestingChange, onStatsUpdate, databaseName, schema, table]);
}

