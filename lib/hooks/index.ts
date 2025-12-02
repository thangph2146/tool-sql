/**
 * Centralized hooks exports
 * Export all hooks from here for consistency
 * 
 * Note: Legacy hooks (use-database-query) are not exported here to avoid conflicts.
 * Import directly from '@/lib/hooks/use-database-query' if you need legacy hooks.
 * TODO: Migrate all components to use new hooks from './queries'
 */

// Query hooks (new architecture) - Preferred
export * from './queries';

// Other hooks
export * from './use-debounce';
export * from './use-flow-logger';
export * from './use-synced-columns';
export * from './use-table-comparison';
export * from './use-table-filters';
export * from './use-table-pagination';
export * from './use-column-filter-options';

// Comparison hooks (extracted from table-comparison-view)
export * from './use-comparison-data';
export * from './use-row-synchronization';
export * from './use-joined-data-maps';
export * from './use-table-testing';
export * from './use-table-stats-manager';
export * from './use-table-list-state';
export * from './use-comparison-loading-states';
export * from './use-table-sorting';

// Export types from legacy hooks (only exported types)
export type { ForeignKeyInfo } from './use-database-query';

