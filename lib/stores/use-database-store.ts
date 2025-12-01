/**
 * Zustand store for database state management
 * Manages global database-related state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DatabaseName } from '@/lib/db-config';

interface DatabaseState {
  // Selected database for operations
  selectedDatabase: DatabaseName | null;
  
  // Comparison tables
  comparisonTables: {
    left: { databaseName: DatabaseName; schema: string; table: string } | null;
    right: { databaseName: DatabaseName; schema: string; table: string } | null;
  };
  
  // Actions
  setSelectedDatabase: (database: DatabaseName | null) => void;
  setComparisonTable: (
    position: 'left' | 'right',
    table: { databaseName: DatabaseName; schema: string; table: string } | null
  ) => void;
  clearComparison: () => void;
  removeComparisonTable: (position: 'left' | 'right') => void;
}

export const useDatabaseStore = create<DatabaseState>()(
  devtools(
    (set) => ({
      // Initial state
      selectedDatabase: null,
      comparisonTables: {
        left: null,
        right: null,
      },
      
      // Actions
      setSelectedDatabase: (database) =>
        set({ selectedDatabase: database }, false, 'setSelectedDatabase'),
      
      setComparisonTable: (position, table) =>
        set(
          (state) => ({
            comparisonTables: {
              ...state.comparisonTables,
              [position]: table,
            },
          }),
          false,
          'setComparisonTable'
        ),
      
      clearComparison: () =>
        set(
          { comparisonTables: { left: null, right: null } },
          false,
          'clearComparison'
        ),
      
      removeComparisonTable: (position) =>
        set(
          (state) => ({
            comparisonTables: {
              ...state.comparisonTables,
              [position]: null,
            },
          }),
          false,
          'removeComparisonTable'
        ),
    }),
    { name: 'DatabaseStore' }
  )
);

