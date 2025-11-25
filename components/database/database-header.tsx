'use client';

import { useMemo } from 'react';
import { Loader2, RefreshCw, Table } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTestConnection, useFetchTables } from '@/lib/hooks/use-database-query';

interface DatabaseHeaderProps {
  onTestAll?: () => void;
  onLoadAllTables?: () => void;
}

export function DatabaseHeader({ onTestAll, onLoadAllTables }: DatabaseHeaderProps) {
  const testConnectionMutation = useTestConnection();
  const fetchTablesMutation = useFetchTables();

  const isLoading = useMemo(
    () => testConnectionMutation.isPending || fetchTablesMutation.isPending,
    [testConnectionMutation.isPending, fetchTablesMutation.isPending]
  );

  const handleTestAll = () => {
    testConnectionMutation.mutate(undefined);
    onTestAll?.();
  };

  const handleLoadAllTables = () => {
    fetchTablesMutation.mutate(undefined);
    onLoadAllTables?.();
  };

  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <h2 className="text-xl font-semibold text-foreground">
        Database Connection Status
      </h2>
      <div className="flex items-center gap-2">
        <button
          onClick={handleLoadAllTables}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'bg-secondary text-secondary-foreground hover:bg-secondary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          )}
          title="Load tables for all connected databases simultaneously"
        >
          <Table className="h-4 w-4" />
          <span className="hidden sm:inline">Load All Tables</span>
          <span className="sm:hidden">Load Tables</span>
        </button>
        <button
          onClick={handleTestAll}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Testing All...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Test All Databases</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

