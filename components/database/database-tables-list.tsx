'use client';

import { useMemo } from 'react';
import { Table, Loader2, RefreshCw } from 'lucide-react';
import type { DatabaseName } from '@/lib/db-config';
import { getDatabaseConfig } from '@/lib/db-config';

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
}

interface DatabaseTablesListProps {
  databaseName: DatabaseName;
  tables?: TableInfo[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function DatabaseTablesList({
  databaseName,
  tables,
  isLoading,
  onRefresh,
}: DatabaseTablesListProps) {
  // Get database config to display actual database name
  const dbConfig = useMemo(() => getDatabaseConfig(databaseName), [databaseName]);
  
  // Memoize table count
  const tableCount = useMemo(() => tables?.length || 0, [tables]);
  
  // Memoize display name
  const displayName = useMemo(() => {
    return dbConfig.displayName || dbConfig.database || databaseName.replace('_', ' ').toUpperCase();
  }, [dbConfig, databaseName]);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Tables in {displayName}
          </h3>
          {tables && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {tableCount} {tableCount === 1 ? 'table' : 'tables'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tables && !isLoading && (
            <button
              onClick={onRefresh}
              className="text-xs text-primary hover:underline flex items-center gap-1"
              title="Refresh tables list"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
          {!tables && !isLoading && (
            <button
              onClick={onRefresh}
              className="text-xs text-primary hover:underline"
            >
              Load Tables
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">
            Loading tables from {displayName}...
          </span>
        </div>
      ) : tables && tables.length > 0 ? (
        <div className="space-y-2">
          <div className="max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tables.map((table) => (
                <div
                  key={`${table.TABLE_SCHEMA}.${table.TABLE_NAME}`}
                  className="flex items-center gap-2 p-2 rounded-md bg-background border border-border hover:bg-accent hover:border-primary/50 transition-colors cursor-pointer group"
                  title={`${table.TABLE_SCHEMA}.${table.TABLE_NAME} in ${databaseName}`}
                >
                  <Table className="h-3 w-3 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {table.TABLE_NAME}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Schema: {table.TABLE_SCHEMA}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
            Showing {tableCount} {tableCount === 1 ? 'table' : 'tables'} from {displayName} database
          </p>
        </div>
      ) : tables && tables.length === 0 ? (
        <div className="text-center py-4">
          <Table className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-xs text-muted-foreground">
            No tables found in {displayName} database
          </p>
        </div>
      ) : null}
    </div>
  );
}

