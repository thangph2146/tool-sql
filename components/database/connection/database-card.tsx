'use client';

import { useMemo } from 'react';
import { Database, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DatabaseName } from '@/lib/db-config';
import { getDatabaseConfig } from '@/lib/db-config';
import { useDatabaseConnection, useDatabaseTables, useTestConnection, useFetchTables } from '@/lib/hooks/use-database-query';
import { DatabaseServerInfo } from './database-server-info';
import { DatabaseTablesList } from '../shared';
import { DatabaseErrorDisplay } from './database-error-display';

interface DatabaseCardProps {
  databaseName: DatabaseName;
  selectedForComparison?: {
    left: { databaseName: DatabaseName; schema: string; table: string } | null;
    right: { databaseName: DatabaseName; schema: string; table: string } | null;
  };
}

export function DatabaseCard({
  databaseName,
  selectedForComparison,
}: DatabaseCardProps) {
  // Get database config to display actual database name
  const dbConfig = useMemo(() => getDatabaseConfig(databaseName), [databaseName]);
  
  const { data: connectionData, isLoading: connectionLoading, isError: connectionError } = 
    useDatabaseConnection(databaseName);
  const { data: tablesData, isLoading: tablesLoading } = 
    useDatabaseTables(databaseName);
  
  const testConnectionMutation = useTestConnection();
  const fetchTablesMutation = useFetchTables();
  
  // Memoize display name (actual database name from config)
  const displayName = useMemo(() => {
    return dbConfig.displayName || dbConfig.database || databaseName.replace('_', ' ').toUpperCase();
  }, [dbConfig, databaseName]);

  // Memoize status calculation
  const status = useMemo(() => {
    if (connectionLoading || testConnectionMutation.isPending) {
      return 'connecting';
    }
    if (connectionError || !connectionData?.success) {
      return 'error';
    }
    if (connectionData?.data?.connected) {
      return 'connected';
    }
    return 'idle';
  }, [connectionLoading, connectionError, connectionData, testConnectionMutation.isPending]);

  // Memoize status icon
  const statusIcon = useMemo(() => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'connecting':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  }, [status]);

  // Memoize status text
  const statusText = useMemo(() => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Not Checked';
    }
  }, [status]);

  // Memoize status color
  const statusColor = useMemo(() => {
    switch (status) {
      case 'connected':
        return 'border-green-500 bg-green-50 dark:bg-green-950/20';
      case 'error':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'connecting':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-gray-300 bg-gray-50 dark:bg-gray-900';
    }
  }, [status]);

  // Memoize tables
  const tables = useMemo(() => {
    if (tablesData?.success) {
      if (tablesData.data.database) {
        // Single database response
        return tablesData.data.tables || [];
      } else {
        // All databases response
        return tablesData.data[databaseName]?.tables || [];
      }
    }
    return undefined;
  }, [tablesData, databaseName]);

  const handleTestConnection = () => {
    testConnectionMutation.mutate(databaseName);
  };

  const handleFetchTables = () => {
    fetchTablesMutation.mutate(databaseName);
  };

  const isLoading = connectionLoading || testConnectionMutation.isPending;
  const isTablesLoading = tablesLoading || fetchTablesMutation.isPending;

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-6 transition-all duration-300',
        statusColor
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {displayName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {statusText} • {dbConfig.database}
            </p>
          </div>
        </div>
        <Button
          onClick={handleTestConnection}
          disabled={isLoading}
          variant="default"
          size="default"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              <span className="hidden sm:inline">Testing...</span>
            </>
          ) : (
            <>
              <RefreshCw />
              <span className="hidden sm:inline">Test Again</span>
            </>
          )}
        </Button>
      </div>

      {connectionData?.data && (
        <p className="text-xs text-muted-foreground mb-4">
          Last checked:{' '}
          {new Date().toLocaleString('en-US')}
        </p>
      )}

      {/* Server Information */}
      {status === 'connected' && connectionData?.data?.serverInfo && (
        <DatabaseServerInfo serverInfo={connectionData.data.serverInfo} />
      )}

      {/* Tables List */}
      {status === 'connected' && (
        <DatabaseTablesList
          databaseName={databaseName}
          tables={tables}
          isLoading={isTablesLoading}
          onRefresh={handleFetchTables}
          onCompareTable={(table) => {
            // This will be handled by parent component
            if (window.dispatchEvent) {
              window.dispatchEvent(
                new CustomEvent('table-compare-request', { detail: table })
              );
            }
          }}
          selectedForComparison={selectedForComparison}
        />
      )}

      {/* Error Message */}
      {status === 'error' && (
        <DatabaseErrorDisplay
          error={
            connectionData?.error ||
            connectionData?.message ||
            'Unable to connect to database'
          }
        />
      )}
    </div>
  );
}

