'use client';

import { useMemo } from 'react';
import { Loader2, RefreshCw, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
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
      <ButtonGroup orientation="horizontal">
        <Button
          onClick={handleLoadAllTables}
          disabled={isLoading}
          variant="secondary"
          size="default"
          title="Load tables for all connected databases simultaneously"
        >
          <Table />
          <span className="hidden sm:inline">Load All Tables</span>
          <span className="sm:hidden">Load Tables</span>
        </Button>
        <Button
          onClick={handleTestAll}
          disabled={isLoading}
          variant="default"
          size="default"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              <span>Testing All...</span>
            </>
          ) : (
            <>
              <RefreshCw />
              <span>Test All Databases</span>
            </>
          )}
        </Button>
      </ButtonGroup>
    </div>
  );
}

