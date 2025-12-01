/**
 * Zustand store for table-related state
 * Manages table selection, filters, pagination, etc.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DatabaseName } from '@/lib/db-config';

interface TableState {
  // Selected table
  selectedTable: {
    databaseName: DatabaseName;
    schema: string;
    table: string;
  } | null;
  
  // Table filters (per table)
  tableFilters: Record<
    string,
    Record<string, string>
  >;
  
  // Table pagination (per table)
  tablePagination: Record<
    string,
    {
      page: number;
      limit: number;
      offset: number;
    }
  >;
  
  // Actions
  setSelectedTable: (table: {
    databaseName: DatabaseName;
    schema: string;
    table: string;
  } | null) => void;
  
  setTableFilters: (
    key: string,
    filters: Record<string, string>
  ) => void;
  
  setTablePagination: (
    key: string,
    pagination: {
      page: number;
      limit: number;
      offset: number;
    }
  ) => void;
  
  clearTableFilters: (key: string) => void;
  clearTablePagination: (key: string) => void;
}

const getTableKey = (
  databaseName: DatabaseName,
  schema: string,
  table: string
): string => {
  return `${databaseName}:${schema}:${table}`;
};

export const useTableStore = create<TableState>()(
  devtools(
    (set) => ({
      // Initial state
      selectedTable: null,
      tableFilters: {},
      tablePagination: {},
      
      // Actions
      setSelectedTable: (table) =>
        set({ selectedTable: table }, false, 'setSelectedTable'),
      
      setTableFilters: (key, filters) =>
        set(
          (state) => ({
            tableFilters: {
              ...state.tableFilters,
              [key]: filters,
            },
          }),
          false,
          'setTableFilters'
        ),
      
      setTablePagination: (key, pagination) =>
        set(
          (state) => ({
            tablePagination: {
              ...state.tablePagination,
              [key]: pagination,
            },
          }),
          false,
          'setTablePagination'
        ),
      
      clearTableFilters: (key) =>
        set(
          (state) => {
            const newFilters = { ...state.tableFilters };
            delete newFilters[key];
            return { tableFilters: newFilters };
          },
          false,
          'clearTableFilters'
        ),
      
      clearTablePagination: (key) =>
        set(
          (state) => {
            const newPagination = { ...state.tablePagination };
            delete newPagination[key];
            return { tablePagination: newPagination };
          },
          false,
          'clearTablePagination'
        ),
    }),
    { name: 'TableStore' }
  )
);

// Helper hook to get table key
export function useTableKey(
  databaseName: DatabaseName | undefined,
  schema: string | undefined,
  table: string | undefined
): string | null {
  if (!databaseName || !schema || !table) return null;
  return getTableKey(databaseName, schema, table);
}

