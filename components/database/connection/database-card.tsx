'use client';

import { useMemo, useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, Loader2, RefreshCw, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DatabaseName } from '@/lib/db-config';
import { getDatabaseConfig } from '@/lib/db-config';
import { getMergedDatabaseConfig } from '@/lib/utils/db-config-storage';
import { useDatabaseConnection, useTestConnection, useFetchTables } from '@/lib/hooks/use-database-query';
import { DatabaseServerInfo } from './database-server-info';
import { DatabaseTablesList } from '../shared';
import { DatabaseErrorDisplay } from './database-error-display';
import { DatabaseConfigDialog } from './database-config-dialog';

interface DatabaseCardProps {
  databaseName: DatabaseName;
  enabled?: boolean;
  selectedForComparison?: {
    left: { databaseName: DatabaseName; schema: string; table: string } | null;
    right: { databaseName: DatabaseName; schema: string; table: string } | null;
  };
}

export function DatabaseCard({
  databaseName,
  enabled = true,
  selectedForComparison,
}: DatabaseCardProps) {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  
  // Get database config to display actual database name
  // Start with base config to avoid hydration mismatch, then update with merged config on client
  const [dbConfig, setDbConfig] = useState(() => getDatabaseConfig(databaseName));
  
  // Update to merged config after mount to avoid hydration mismatch
  useEffect(() => {
    setDbConfig(getMergedDatabaseConfig(databaseName));
  }, [databaseName]);
  
  const { data: connectionData, isLoading: connectionLoading, isError: connectionError } = 
    useDatabaseConnection(databaseName, enabled);
  
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

  // DatabaseTablesList component manages its own data fetching via useDatabaseTables hook
  // No need to fetch tables here to avoid duplicate API calls

  const handleTestConnection = () => {
    testConnectionMutation.mutate(databaseName);
  };

  const handleFetchTables = () => {
    fetchTablesMutation.mutate(databaseName);
  };

  const isLoading = connectionLoading || testConnectionMutation.isPending;

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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setConfigDialogOpen(true)}
            variant="outline"
            size="default"
            title="Cấu hình database"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Cấu hình</span>
          </Button>
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

      {/* Config Dialog */}
      <DatabaseConfigDialog
        databaseName={databaseName}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onConfigSaved={() => {
          // Config will trigger page reload, so no need to do anything here
        }}
      />
    </div>
  );
}

