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

  // Sync when allColumns changes, but preserve user selections
  useLayoutEffect(() => {
    if (prevKeyRef.current !== allColumnsKey) {
      const prevKey = prevKeyRef.current;
      prevKeyRef.current = allColumnsKey;
      syncPendingRef.current = false;
      
      // Always preserve user selections when columns change
      // This includes combined columns which may not be in allColumns
      syncPendingRef.current = true;
      const frameId = requestAnimationFrame(() => {
        if (syncPendingRef.current) {
          setSelectedColumns((prev) => {
            if (allColumns.length === 0) {
              // If allColumns is empty, preserve all previous selections (including combined columns)
              return prev;
            }
            
            const preserved = new Set<string>();
            // Keep columns that exist in allColumns OR are in previous selection (preserve combined columns)
            prev.forEach(col => {
              // Always preserve if it's in allColumns, or if it's a previous selection (could be combined column)
              if (allColumns.includes(col)) {
                preserved.add(col);
              } else if (prev.size > 0) {
                // Preserve previous selections even if not in allColumns (for combined columns)
                // This ensures combined columns are not lost when filtering
                preserved.add(col);
              }
            });
            
            // If user has modified, always preserve their selections
            if (userModifiedRef.current) {
              return preserved.size > 0 ? preserved : prev;
            }
            
            // If no previous selections and this is initial load, select all
            if (prev.size === 0 && prevKey === '') {
              return new Set(allColumns);
            }
            
            // If we have preserved selections, return them
            if (preserved.size > 0) {
              return preserved;
            }
            
            // Otherwise, if this is initial load and no preserved, select all
            if (prevKey === '') {
              return new Set(allColumns);
            }
            
            // Keep previous selections
            return prev;
          });
          syncPendingRef.current = false;
        }
      });
      
      return () => {
        cancelAnimationFrame(frameId);
        syncPendingRef.current = false;
      };
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

