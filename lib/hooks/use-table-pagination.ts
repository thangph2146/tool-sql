import { useState, useEffect, useMemo, useCallback } from "react";
import { DEFAULT_TABLE_PAGE } from "@/lib/constants/table-constants";

interface UseTablePaginationProps {
  totalRows: number;
  limit: number;
  onLimitChange?: (limit: number) => void;
}

interface UseTablePaginationReturn {
  page: number;
  setPage: (page: number) => void;
  pageInput: string;
  setPageInput: (value: string) => void;
  offset: number;
  currentPage: number;
  totalPages: number;
  handlePrevious: () => void;
  handleNext: () => void;
  handleFirstPage: () => void;
  handleLastPage: () => void;
  handlePageInputChange: (value: string) => void;
  handlePageInputSubmit: () => void;
  handlePageInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleLimitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * Custom hook for table pagination logic
 */
export function useTablePagination({
  totalRows,
  limit,
  onLimitChange,
}: UseTablePaginationProps): UseTablePaginationReturn {
  const [page, setPage] = useState(DEFAULT_TABLE_PAGE);
  const [pageInput, setPageInput] = useState("1");
  
  // Memoize computed values
  const offset = useMemo(() => page * limit, [page, limit]);
  const totalPages = useMemo(() => Math.ceil(totalRows / limit), [totalRows, limit]);
  const currentPage = useMemo(() => page + 1, [page]);

  // Reset page to 0 when limit changes
  useEffect(() => {
    setPage(0);
    setPageInput("1");
  }, [limit]);

  // Update pageInput when page changes
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Memoize handlers with useCallback
  const handlePrevious = useCallback(() => {
    if (page > 0) {
      setPage(page - 1);
    }
  }, [page]);

  const handleNext = useCallback(() => {
    if (page < totalPages - 1) {
      setPage(page + 1);
    }
  }, [page, totalPages]);

  const handleFirstPage = useCallback(() => {
    setPage(0);
  }, []);

  const handleLastPage = useCallback(() => {
    if (totalPages > 0) {
      setPage(totalPages - 1);
    }
  }, [totalPages]);

  const handlePageInputChange = useCallback((value: string) => {
    setPageInput(value);
  }, []);

  const handlePageInputSubmit = useCallback(() => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum - 1);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, totalPages, currentPage]);

  const handlePageInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputSubmit();
    }
  }, [handlePageInputSubmit]);

  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = parseInt(e.target.value, 10);
    onLimitChange?.(newLimit);
  }, [onLimitChange]);

  return {
    page,
    setPage,
    pageInput,
    setPageInput,
    offset,
    currentPage,
    totalPages,
    handlePrevious,
    handleNext,
    handleFirstPage,
    handleLastPage,
    handlePageInputChange,
    handlePageInputSubmit,
    handlePageInputKeyDown,
    handleLimitChange,
  };
}

