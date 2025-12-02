"use client";

import { memo, useMemo } from "react";
import { TableRowItem } from "./table-row-item";
import type { DatabaseName } from "@/lib/db-config";

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
  rowCount?: number | null;
  columnCount?: number | null;
  relationshipCount?: number | null;
}

interface TableRowItemWrapperProps {
  table: TableInfo;
  databaseName: DatabaseName;
  selectedForComparison?: {
    left: { databaseName: DatabaseName; schema: string; table: string } | null;
    right: { databaseName: DatabaseName; schema: string; table: string } | null;
  };
  tableKey: string;
  status: "idle" | "testing" | "success" | "error";
  isTesting: boolean;
  hasError: boolean;
  stats: {
    rowCount: number;
    columnCount: number;
    relationshipCount: number;
  } | null;
  hasStats: boolean;
  onTableClick: (schema: string, table: string) => void;
  onCompareTable?: (table: {
    databaseName: DatabaseName;
    schema: string;
    table: string;
  }) => void;
  onStatusChange: (schema: string, table: string, status: "idle" | "testing" | "success" | "error") => void;
  onErrorChange: (schema: string, table: string, hasError: boolean) => void;
  onTestingChange: (schema: string, table: string, isTesting: boolean) => void;
  onStatsUpdate: (schema: string, table: string, partialStats: { columnCount: number }) => void;
  onStatsFetched: (schema: string, table: string, stats: {
    rowCount: number;
    columnCount: number;
    relationshipCount: number;
  }) => void;
  tables: TableInfo[];
}

function TableRowItemWrapperComponent({
  table,
  databaseName,
  selectedForComparison,
  tableKey,
  status,
  isTesting,
  hasError,
  stats,
  hasStats,
  onTableClick,
  onCompareTable,
  onStatusChange,
  onErrorChange,
  onTestingChange,
  onStatsUpdate,
  onStatsFetched,
  tables,
}: TableRowItemWrapperProps) {
  // Memoize selection state computation
  const { isSelectedLeft, isSelectedRight } = useMemo(() => {
    const isSelectedLeft =
      selectedForComparison?.left?.databaseName === databaseName &&
      selectedForComparison?.left?.schema === table.TABLE_SCHEMA &&
      selectedForComparison?.left?.table === table.TABLE_NAME;

    const isSelectedRight =
      selectedForComparison?.right?.databaseName === databaseName &&
      selectedForComparison?.right?.schema === table.TABLE_SCHEMA &&
      selectedForComparison?.right?.table === table.TABLE_NAME;

    return { isSelectedLeft, isSelectedRight };
  }, [
    selectedForComparison?.left?.databaseName,
    selectedForComparison?.left?.schema,
    selectedForComparison?.left?.table,
    selectedForComparison?.right?.databaseName,
    selectedForComparison?.right?.schema,
    selectedForComparison?.right?.table,
    databaseName,
    table.TABLE_SCHEMA,
    table.TABLE_NAME,
  ]);

  return (
    <TableRowItem
      key={tableKey}
      table={table}
      databaseName={databaseName}
      isSelectedLeft={isSelectedLeft}
      isSelectedRight={isSelectedRight}
      status={status}
      isTesting={isTesting}
      hasError={hasError}
      stats={stats}
      hasStats={hasStats}
      onTableClick={onTableClick}
      onCompareTable={onCompareTable}
      onStatusChange={onStatusChange}
      onErrorChange={onErrorChange}
      onTestingChange={onTestingChange}
      onStatsUpdate={onStatsUpdate}
      onStatsFetched={onStatsFetched}
      tables={tables}
    />
  );
}

// Memoize wrapper to prevent unnecessary re-renders
export const TableRowItemWrapper = memo(TableRowItemWrapperComponent);

