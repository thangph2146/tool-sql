'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Database } from 'lucide-react';
import type { DatabaseName } from '@/lib/db-config';
import { useTableData } from '@/lib/hooks/use-database-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface TableDataViewProps {
  databaseName: DatabaseName;
  schemaName: string;
  tableName: string;
  onClose: () => void;
}

const LIMIT_OPTIONS = [10, 25, 50, 100, 200, 500];

export function TableDataView({
  databaseName,
  schemaName,
  tableName,
  onClose,
}: TableDataViewProps) {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(100);
  const [pageInput, setPageInput] = useState('1');
  const offset = page * limit;

  // Reset page to 0 when limit changes
  useEffect(() => {
    setPage(0);
    setPageInput('1');
  }, [limit]);

  const { data, isLoading, error } = useTableData(
    databaseName,
    schemaName,
    tableName,
    limit,
    offset,
    true
  );

  const tableData = data?.data;
  const totalPages = useMemo(() => {
    if (!tableData) return 0;
    return Math.ceil(tableData.totalRows / limit);
  }, [tableData, limit]);

  const currentPage = useMemo(() => page + 1, [page]);

  // Update pageInput when page changes
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePrevious = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const handleNext = () => {
    if (tableData?.hasMore) {
      setPage(page + 1);
    }
  };

  const handleFirstPage = () => {
    setPage(0);
  };

  const handleLastPage = () => {
    if (tableData && totalPages > 0) {
      setPage(totalPages - 1);
    }
  };

  const handlePageInputChange = (value: string) => {
    setPageInput(value);
  };

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum - 1);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    }
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = parseInt(e.target.value, 10);
    setLimit(newLimit);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {schemaName}.{tableName}
              </h2>
              <p className="text-xs text-muted-foreground">
                Database: {databaseName}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading table data...
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Database className="h-12 w-12 text-destructive mb-4 opacity-50" />
              <p className="text-sm font-medium text-foreground mb-2">
                Error loading table data
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
            </div>
          ) : tableData && tableData.rows.length > 0 ? (
            <>
              <div className="flex-1 border-b border-border p-4 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0">
                  <Table containerClassName="h-full max-h-full">
                    <TableHeader>
                      <TableRow>
                        {tableData.columns.map((column) => (
                          <TableHead key={column} className="font-semibold">
                            {column}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {tableData.columns.map((column) => (
                            <TableCell key={column} className="max-w-xs">
                              <div className="truncate" title={String(row[column] ?? '')}>
                                {row[column] !== null && row[column] !== undefined
                                  ? String(row[column])
                                  : <span className="text-muted-foreground italic">NULL</span>}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-t border-border">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    Showing {offset + 1} - {Math.min(offset + limit, tableData.totalRows)} of{' '}
                    {tableData.totalRows} rows
                  </div>
                  <Field orientation="horizontal" className="gap-2">
                    <FieldLabel className="text-xs">Rows per page:</FieldLabel>
                    <FieldContent>
                      <select
                        value={limit}
                        onChange={handleLimitChange}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {LIMIT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </FieldContent>
                  </Field>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFirstPage}
                    disabled={page === 0}
                    title="First page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Page</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages || 1}
                      value={pageInput}
                      onChange={(e) => handlePageInputChange(e.target.value)}
                      onBlur={handlePageInputSubmit}
                      onKeyDown={handlePageInputKeyDown}
                      className="h-8 w-16 text-center text-xs"
                    />
                    <span className="text-xs text-muted-foreground">of {totalPages || 1}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={!tableData.hasMore}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLastPage}
                    disabled={!tableData.hasMore || currentPage >= totalPages}
                    title="Last page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : tableData && tableData.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm font-medium text-foreground mb-2">
                No data found
              </p>
              <p className="text-xs text-muted-foreground">
                This table is empty
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

