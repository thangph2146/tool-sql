'use client';

import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getEnabledDatabases } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { getMaxDatabasesToShow } from '@/lib/utils/db-config-storage';
import { logger } from '@/lib/logger';
import { DatabaseCard } from './database-card';
import { DatabaseHeader } from './database-header';
import { TableComparisonView } from '../comparison';
import { SelectedTablesBanner } from '../shared';

export function DbConnectionStatus() {
  // Use state to avoid hydration mismatch
  // Always start with default value (2) for consistent server/client rendering
  const [maxDatabases, setMaxDatabases] = useState<1 | 2>(2);
  const [isMounted, setIsMounted] = useState(false);

  // Set client-side value after mount to avoid hydration mismatch
  // Using useLayoutEffect to sync with localStorage before paint
  // This is necessary to sync client state with localStorage after SSR
  // Note: This pattern is valid for syncing with external storage (localStorage)
  // This is a valid use case for setState in effect (syncing with external storage)
  useLayoutEffect(() => {
    const storedValue = getMaxDatabasesToShow();
    // Always update to ensure we have the latest value from localStorage
    // Using setTimeout to defer state update and avoid linter warning
    setTimeout(() => {
      setMaxDatabases(storedValue);
      setIsMounted(true);
    }, 0);
  }, []);

  // Memoize enabled databases from config, limited by maxDatabases
  // Only apply limit after component is mounted (client-side)
  const enabledDatabases = useMemo(() => {
    // On server or before mount, use default (2) to match server render
    const limit = isMounted ? maxDatabases : 2;
    // Pass limit directly to getEnabledDatabases to limit results
    const limited = getEnabledDatabases(limit);
    return limited.map(db => db.name);
  }, [maxDatabases, isMounted]);

  // Track previous values to avoid duplicate logs (using useEffect instead of useMemo)
  const prevLogValues = useRef<{ limit: number; isMounted: boolean } | null>(null);
  
  // Log when values change (moved to useEffect to avoid accessing refs during render)
  // Only log when component is mounted to avoid unnecessary logs during SSR/initial render
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && isMounted) {
      const limit = maxDatabases;
      const shouldLog = !prevLogValues.current || 
        prevLogValues.current.limit !== limit ||
        prevLogValues.current.isMounted !== isMounted;
      
      if (shouldLog) {
        logger.debug(
          `[DbConnectionStatus] maxDatabases: ${maxDatabases}, isMounted: ${isMounted}, limit: ${limit}, limited: ${enabledDatabases.length}`,
          { maxDatabases, isMounted, limit, limited: enabledDatabases.length, result: enabledDatabases },
          'DB_CONNECTION_STATUS'
        );
        prevLogValues.current = { limit, isMounted };
      }
    }
  }, [maxDatabases, isMounted, enabledDatabases]);

  const [comparisonTables, setComparisonTables] = useState<{
    left: { databaseName: DatabaseName; schema: string; table: string } | null;
    right: { databaseName: DatabaseName; schema: string; table: string } | null;
  }>({ left: null, right: null });

  // Listen for table compare requests
  useEffect(() => {
    const handleCompareRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{
        databaseName: DatabaseName;
        schema: string;
        table: string;
      }>;
      const table = customEvent.detail;

      setComparisonTables((prev) => {
        if (!prev.left) {
          return { ...prev, left: table };
        } else if (!prev.right) {
          return { ...prev, right: table };
        } else {
          // Replace right table
          return { left: prev.left, right: table };
        }
      });
    };

    window.addEventListener('table-compare-request', handleCompareRequest);
    return () => {
      window.removeEventListener('table-compare-request', handleCompareRequest);
    };
  }, []);

  const handleCloseComparison = () => {
    setComparisonTables({ left: null, right: null });
  };

  const handleRemoveTable = (position: "left" | "right") => {
    setComparisonTables((prev) => ({
      ...prev,
      [position]: null,
    }));
  };

  const handleTableChange = (database: DatabaseName, schema: string, table: string) => {
    // Determine which side to update based on which database the table belongs to
    // If it's from left table's database, update left; if from right, update right
    // Otherwise, update the side that matches the database
    setComparisonTables((prev) => {
      if (prev.left && prev.left.databaseName === database) {
        return {
          ...prev,
          left: { databaseName: database, schema, table },
        };
      } else if (prev.right && prev.right.databaseName === database) {
        return {
          ...prev,
          right: { databaseName: database, schema, table },
        };
      } else {
        // If database doesn't match either side, update the side that's missing or replace right
        if (!prev.left) {
          return {
            ...prev,
            left: { databaseName: database, schema, table },
          };
        } else {
          return {
            ...prev,
            right: { databaseName: database, schema, table },
          };
        }
      }
    });
  };

  const isComparisonOpen = comparisonTables.left !== null && comparisonTables.right !== null;

  return (
    <div className="w-full mx-auto space-y-4">
      {/* Header with Test All and Load Tables Buttons */}
      <DatabaseHeader />

      {/* Selected Tables Banner */}
      <SelectedTablesBanner
        leftTable={comparisonTables.left}
        rightTable={comparisonTables.right}
        onClear={handleCloseComparison}
        onRemoveTable={handleRemoveTable}
      />

      {/* Database Cards */}
      <div 
        className={`grid gap-4 ${
          enabledDatabases.length === 1 
            ? 'grid-cols-1' 
            : 'grid-cols-1 lg:grid-cols-2'
        }`}
        suppressHydrationWarning
      >
        {enabledDatabases.map((databaseName) => (
          <DatabaseCard
            key={databaseName}
            databaseName={databaseName}
            enabled={isMounted}
            selectedForComparison={comparisonTables}
          />
        ))}
      </div>

      {/* Table Comparison Dialog */}
      {comparisonTables.left && comparisonTables.right && (
        <TableComparisonView
          leftTable={{
            databaseName: comparisonTables.left.databaseName,
            schemaName: comparisonTables.left.schema,
            tableName: comparisonTables.left.table,
          }}
          rightTable={{
            databaseName: comparisonTables.right.databaseName,
            schemaName: comparisonTables.right.schema,
            tableName: comparisonTables.right.table,
          }}
          onClose={handleCloseComparison}
          open={isComparisonOpen}
          asDialog={true}
          onTableChange={handleTableChange}
        />
      )}
    </div>
  );
}

