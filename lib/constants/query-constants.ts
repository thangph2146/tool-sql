/**
 * Query-related constants
 * Constants for TanStack Query configuration
 */

// Query stale times (in milliseconds)
export const QUERY_STALE_TIME = {
  // Short-lived data (connections, real-time data)
  SHORT: 5 * 1000, // 5 seconds
  
  // Medium-lived data (tables list, table data)
  MEDIUM: 30 * 1000, // 30 seconds
  
  // Long-lived data (relationships, stats)
  LONG: 5 * 60 * 1000, // 5 minutes
  
  // Very long-lived data (static config)
  VERY_LONG: 30 * 60 * 1000, // 30 minutes
} as const;

// Query cache times (in milliseconds)
export const QUERY_CACHE_TIME = {
  // Short cache
  SHORT: 5 * 60 * 1000, // 5 minutes
  
  // Medium cache
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  
  // Long cache
  LONG: 60 * 60 * 1000, // 1 hour
} as const;

// Retry configuration
export const QUERY_RETRY = {
  // No retry
  NONE: 0,
  
  // Single retry
  ONCE: 1,
  
  // Multiple retries
  MULTIPLE: 3,
} as const;

// Refetch intervals (in milliseconds)
export const QUERY_REFETCH_INTERVAL = {
  // Real-time updates
  REALTIME: 5 * 1000, // 5 seconds
  
  // Frequent updates
  FREQUENT: 30 * 1000, // 30 seconds
  
  // Normal updates
  NORMAL: 60 * 1000, // 1 minute
  
  // Infrequent updates
  INFREQUENT: 5 * 60 * 1000, // 5 minutes
} as const;

