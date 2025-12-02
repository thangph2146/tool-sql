/**
 * Zustand store for table comparison state management
 * Manages comparison-related state (limits, filters, columns, etc.)
 * Uses selectors to prevent unnecessary re-renders
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CombinedColumn } from '@/components/database/comparison/column-selector';
import { DEFAULT_TABLE_LIMIT } from '@/lib/constants/table-constants';

interface ComparisonState {
  // Limits
  leftLimit: number;
  rightLimit: number;
  
  // Filter visibility
  showLeftFilters: boolean;
  showRightFilters: boolean;
  
  // Combined columns
  combinedColumns: CombinedColumn[];
  
  // Column priorities (per side)
  leftColumnPriorities: Map<string, number>;
  rightColumnPriorities: Map<string, number>;
  
  // Sort orders (per side)
  leftSortOrder: 'alphabetical' | 'newest' | 'oldest';
  rightSortOrder: 'alphabetical' | 'newest' | 'oldest';
  
  // Summary dialog
  showSummaryDialog: boolean;
  
  // Include references
  includeReferences: boolean;
  
  // Actions
  setLeftLimit: (limit: number) => void;
  setRightLimit: (limit: number) => void;
  setShowLeftFilters: (show: boolean) => void;
  setShowRightFilters: (show: boolean) => void;
  setCombinedColumns: (columns: CombinedColumn[]) => void;
  setLeftColumnPriorities: (priorities: Map<string, number>) => void;
  setRightColumnPriorities: (priorities: Map<string, number>) => void;
  setLeftSortOrder: (order: 'alphabetical' | 'newest' | 'oldest') => void;
  setRightSortOrder: (order: 'alphabetical' | 'newest' | 'oldest') => void;
  setShowSummaryDialog: (show: boolean) => void;
  setIncludeReferences: (include: boolean) => void;
  reset: () => void;
}

const initialState = {
  leftLimit: DEFAULT_TABLE_LIMIT,
  rightLimit: DEFAULT_TABLE_LIMIT,
  showLeftFilters: false,
  showRightFilters: false,
  combinedColumns: [] as CombinedColumn[],
  leftColumnPriorities: new Map<string, number>(),
  rightColumnPriorities: new Map<string, number>(),
  leftSortOrder: 'alphabetical' as const,
  rightSortOrder: 'alphabetical' as const,
  showSummaryDialog: false,
  includeReferences: true,
};

export const useComparisonStore = create<ComparisonState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setLeftLimit: (limit) =>
        set({ leftLimit: limit }, false, 'setLeftLimit'),
      
      setRightLimit: (limit) =>
        set({ rightLimit: limit }, false, 'setRightLimit'),
      
      setShowLeftFilters: (show) =>
        set({ showLeftFilters: show }, false, 'setShowLeftFilters'),
      
      setShowRightFilters: (show) =>
        set({ showRightFilters: show }, false, 'setShowRightFilters'),
      
      setCombinedColumns: (columns) =>
        set({ combinedColumns: columns }, false, 'setCombinedColumns'),
      
      setLeftColumnPriorities: (priorities) =>
        set({ leftColumnPriorities: priorities }, false, 'setLeftColumnPriorities'),
      
      setRightColumnPriorities: (priorities) =>
        set({ rightColumnPriorities: priorities }, false, 'setRightColumnPriorities'),
      
      setLeftSortOrder: (order) =>
        set({ leftSortOrder: order }, false, 'setLeftSortOrder'),
      
      setRightSortOrder: (order) =>
        set({ rightSortOrder: order }, false, 'setRightSortOrder'),
      
      setShowSummaryDialog: (show) =>
        set({ showSummaryDialog: show }, false, 'setShowSummaryDialog'),
      
      setIncludeReferences: (include) =>
        set({ includeReferences: include }, false, 'setIncludeReferences'),
      
      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'ComparisonStore' }
  )
);

// Selectors for optimized re-renders
// Note: In Zustand v5, shallow comparison is built-in for object selectors
export const useComparisonLimits = () =>
  useComparisonStore((state) => ({ leftLimit: state.leftLimit, rightLimit: state.rightLimit }));

export const useComparisonFilters = () =>
  useComparisonStore((state) => ({
    showLeftFilters: state.showLeftFilters,
    showRightFilters: state.showRightFilters,
  }));

export const useComparisonColumns = () =>
  useComparisonStore((state) => state.combinedColumns);

export const useComparisonPriorities = () =>
  useComparisonStore((state) => ({
    leftColumnPriorities: state.leftColumnPriorities,
    rightColumnPriorities: state.rightColumnPriorities,
  }));

export const useComparisonSortOrders = () =>
  useComparisonStore((state) => ({
    leftSortOrder: state.leftSortOrder,
    rightSortOrder: state.rightSortOrder,
  }));

