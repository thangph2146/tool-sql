import { useState, useMemo, useRef, useLayoutEffect } from 'react';

/**
 * Hook to manage selected columns with automatic sync from external source
 * Uses useLayoutEffect with proper cleanup to avoid React warnings
 */
export function useSyncedColumns(allColumns: string[]) {
  // Create stable key for allColumns
  const allColumnsKey = useMemo(() => allColumns.join(','), [allColumns]);
  
  // Compute desired initial state
  const initialSelectedColumns = useMemo(() => {
    return allColumns.length > 0 ? new Set(allColumns) : new Set<string>();
  }, [allColumns]);
  
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(initialSelectedColumns);
  const prevKeyRef = useRef<string>(allColumnsKey);
  const userModifiedRef = useRef<boolean>(false);
  const syncPendingRef = useRef<boolean>(false);

  // Sync when allColumns changes, but only if user hasn't manually modified
  useLayoutEffect(() => {
    if (prevKeyRef.current !== allColumnsKey) {
      prevKeyRef.current = allColumnsKey;
      syncPendingRef.current = false;
      
      // Reset user modification flag when columns change
      if (!userModifiedRef.current) {
        syncPendingRef.current = true;
        // Use requestAnimationFrame to defer state update
        const frameId = requestAnimationFrame(() => {
          if (syncPendingRef.current) {
            setSelectedColumns((prev) => {
              if (allColumns.length === 0) {
                return prev.size > 0 ? new Set<string>() : prev;
              }
              const prevArray = Array.from(prev).sort();
              const allColumnsSorted = [...allColumns].sort();
              const isMatching =
                prevArray.length === allColumnsSorted.length &&
                prevArray.every((val, idx) => val === allColumnsSorted[idx]);
              
              // Only update if empty or significantly different
              if (prev.size === 0 || !isMatching) {
                return new Set(allColumns);
              }
              return prev;
            });
            syncPendingRef.current = false;
          }
        });
        
        return () => {
          cancelAnimationFrame(frameId);
          syncPendingRef.current = false;
        };
      } else {
        // Reset flag for next change
        userModifiedRef.current = false;
      }
    }
  }, [allColumnsKey, allColumns]);

  // Wrapper to track user modifications
  const setSelectedColumnsWithTracking = (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    userModifiedRef.current = true;
    syncPendingRef.current = false;
    if (typeof updater === 'function') {
      setSelectedColumns(updater);
    } else {
      setSelectedColumns(updater);
    }
  };

  return [selectedColumns, setSelectedColumnsWithTracking] as const;
}

