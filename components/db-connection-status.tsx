'use client';

import { useMemo, useState, useEffect } from 'react';
import { getEnabledDatabases } from '@/lib/db-config';
import type { DatabaseName } from '@/lib/db-config';
import { DatabaseCard } from './database/database-card';
import { DatabaseHeader } from './database/database-header';
import { DatabaseInstructions } from './database/database-instructions';
import { TableComparisonView } from './database/table-comparison-view';
import { SelectedTablesBanner } from './database/selected-tables-banner';

export function DbConnectionStatus() {
  // Memoize enabled databases from config
  const enabledDatabases = useMemo(() => {
    return getEnabledDatabases().map(db => db.name);
  }, []);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {enabledDatabases.map((databaseName) => (
          <DatabaseCard
            key={databaseName}
            databaseName={databaseName}
            selectedForComparison={comparisonTables}
          />
        ))}
      </div>

      {/* Instructions */}
      <DatabaseInstructions />

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
        />
      )}
    </div>
  );
}
