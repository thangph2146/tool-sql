"use client";

import { useTableTestResult } from '@/lib/hooks';
import type { DatabaseName } from '@/lib/db-config';

interface TableTesterProps {
  databaseName: DatabaseName;
  schema: string;
  table: string;
  isTesting: boolean;
  status: 'idle' | 'testing' | 'success' | 'error';
  onStatusChange: (status: 'idle' | 'testing' | 'success' | 'error') => void;
  onErrorChange: (hasError: boolean) => void;
  onTestingChange: (isTesting: boolean) => void;
  onStatsUpdate?: (stats: { columnCount: number }) => void;
}

export function TableTester({
  databaseName,
  schema,
  table,
  isTesting,
  status,
  onStatusChange,
  onErrorChange,
  onTestingChange,
  onStatsUpdate,
}: TableTesterProps) {
  // Only enable test when explicitly testing (click) or retrying after error
  const shouldTest = isTesting || status === 'error';

  useTableTestResult({
    databaseName,
    schema,
    table,
    shouldTest,
    onStatusChange,
    onErrorChange,
    onTestingChange,
    onStatsUpdate,
  });

  return null; // This component doesn't render anything
}

