'use client';

import { useMemo } from 'react';
import { getEnabledDatabases } from '@/lib/db-config';
import { DatabaseCard } from './database/database-card';
import { DatabaseHeader } from './database/database-header';
import { DatabaseInstructions } from './database/database-instructions';

export function DbConnectionStatus() {
  // Memoize enabled databases from config
  const enabledDatabases = useMemo(() => {
    return getEnabledDatabases().map(db => db.name);
  }, []);

  return (
    <div className="w-full mx-auto space-y-4">
      {/* Header with Test All and Load Tables Buttons */}
      <DatabaseHeader />

      {/* Database Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {enabledDatabases.map((databaseName) => (
          <DatabaseCard key={databaseName} databaseName={databaseName} />
        ))}
      </div>

      {/* Instructions */}
      <DatabaseInstructions />
    </div>
  );
}
