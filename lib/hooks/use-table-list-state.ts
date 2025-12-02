import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDebounce } from './use-debounce';
import {
  DEFAULT_TABLE_LIST_LIMIT,
  DEFAULT_TABLE_PAGE,
} from '@/lib/constants/table-constants';

interface UseTableListStateReturn {
  filterText: string;
  debouncedFilterText: string;
  page: number;
  limit: number;
  setFilterText: (text: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  handleClearFilter: () => void;
  currentPage: number;
  offset: number;
}

export function useTableListState(): UseTableListStateReturn {
  const [filterText, setFilterText] = useState('');
  const [page, setPage] = useState(DEFAULT_TABLE_PAGE);
  const [limit, setLimit] = useState(DEFAULT_TABLE_LIST_LIMIT);
  const prevDebouncedFilterRef = useRef<string>('');
  const prevLimitRef = useRef<number>(DEFAULT_TABLE_LIST_LIMIT);

  // Debounce filter text to avoid too many API calls while typing
  const debouncedFilterText = useDebounce(filterText, 500);

  // Reset page when debounced filter changes (using ref to avoid effect warnings)
  useEffect(() => {
    if (prevDebouncedFilterRef.current !== debouncedFilterText && page !== 0) {
      prevDebouncedFilterRef.current = debouncedFilterText;
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setPage(0), 0);
    }
  }, [debouncedFilterText, page]);

  // Reset page when limit changes (using ref to avoid effect warnings)
  useEffect(() => {
    if (prevLimitRef.current !== limit && page !== 0) {
      prevLimitRef.current = limit;
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setPage(0), 0);
    }
  }, [limit, page]);

  const handleClearFilter = useCallback(() => {
    setFilterText('');
  }, []);

  // Pagination calculations
  const currentPage = useMemo(() => page + 1, [page]);
  const offset = useMemo(() => page * limit, [page, limit]);

  return {
    filterText,
    debouncedFilterText,
    page,
    limit,
    setFilterText,
    setPage,
    setLimit,
    handleClearFilter,
    currentPage,
    offset,
  };
}
