'use client';

import { useMemo, useState } from 'react';
import { Table, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DatabaseName } from '@/lib/db-config';
import { getDatabaseConfig } from '@/lib/db-config';
import { TableDataView } from './table-data-view';

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
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    table: string;
  } | null>(null);

  // Get database config to display actual database name
  const dbConfig = useMemo(() => getDatabaseConfig(databaseName), [databaseName]);
  
  // Memoize table count
  const tableCount = useMemo(() => tables?.length || 0, [tables]);
  
  // Memoize display name
  const displayName = useMemo(() => {
    return dbConfig.displayName || dbConfig.database || databaseName.replace('_', ' ').toUpperCase();
  }, [dbConfig, databaseName]);

  const handleTableClick = (schema: string, table: string) => {
    setSelectedTable({ schema, table });
  };

  const handleCloseTableData = () => {
    setSelectedTable(null);
  };

  return (
    <div className="mt-4 pt-4">
      <Separator className="mb-4" />
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
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              title="Refresh tables list"
            >
              <RefreshCw />
              Refresh
            </Button>
          )}
          {!tables && !isLoading && (
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
            >
              Load Tables
            </Button>
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
          <ScrollArea className="max-h-64">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-4">
              {tables.map((table) => (
                <div
                  key={`${table.TABLE_SCHEMA}.${table.TABLE_NAME}`}
                  onClick={() => handleTableClick(table.TABLE_SCHEMA, table.TABLE_NAME)}
                  className="flex items-center gap-2 p-2 rounded-md bg-background border border-border hover:bg-accent hover:border-primary/50 transition-colors cursor-pointer group"
                  title={`Click to view data: ${table.TABLE_SCHEMA}.${table.TABLE_NAME} in ${databaseName}`}
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
          </ScrollArea>
          <Separator />
          <p className="text-xs text-muted-foreground text-center pt-2">
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

      {/* Table Data View Modal */}
      {selectedTable && (
        <TableDataView
          databaseName={databaseName}
          schemaName={selectedTable.schema}
          tableName={selectedTable.table}
          onClose={handleCloseTableData}
        />
      )}
    </div>
  );
}

