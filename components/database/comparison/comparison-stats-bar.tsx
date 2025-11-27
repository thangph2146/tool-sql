"use client";

import { useMemo } from "react";
import type { DuplicateGroup } from "@/lib/utils/data-quality-utils";

interface ComparisonStatsBarProps {
  leftTable: { databaseName: string; schemaName: string; tableName: string };
  rightTable: { databaseName: string; schemaName: string; tableName: string };
  leftTableData?: { totalRows: number; columns: string[] };
  rightTableData?: { totalRows: number; columns: string[] };
  differenceCount: number;
  columnsToCompare: string[];
  allColumns: string[];
  leftRelationships: unknown[];
  rightRelationships: unknown[];
  leftDataQuality: {
    duplicateGroups: DuplicateGroup[];
    duplicateIndexSet: Set<number>;
    redundantColumns: string[];
    nameDuplicateGroups: DuplicateGroup[];
    nameDuplicateIndexSet: Set<number>;
  };
  rightDataQuality: {
    duplicateGroups: DuplicateGroup[];
    duplicateIndexSet: Set<number>;
    redundantColumns: string[];
    nameDuplicateGroups: DuplicateGroup[];
    nameDuplicateIndexSet: Set<number>;
  };
}

export function ComparisonStatsBar({
  leftTable,
  rightTable,
  leftTableData,
  rightTableData,
  differenceCount,
  columnsToCompare,
  allColumns,
  leftRelationships,
  rightRelationships,
  leftDataQuality,
  rightDataQuality,
}: ComparisonStatsBarProps) {
  const stats = useMemo(() => {
    const items: Array<{ label: string; value: string | number; variant?: "default" | "primary" | "warning" }> = [];

    if (leftTableData) {
      items.push({
        label: "Trái",
        value: `${leftTable.databaseName} (${leftTableData.totalRows} hàng, ${leftTableData.columns.length} cột)`,
      });
    }

    if (rightTableData) {
      items.push({
        label: "Phải",
        value: `${rightTable.databaseName} (${rightTableData.totalRows} hàng, ${rightTableData.columns.length} cột)`,
      });
    }

    items.push({
      label: "Khác biệt",
      value: differenceCount,
      variant: "primary",
    });

    items.push({
      label: "Đang so sánh",
      value: `${columnsToCompare.length} / ${allColumns.length} cột`,
    });

    const totalRelationships = leftRelationships.length + rightRelationships.length;
    if (totalRelationships > 0) {
      items.push({
        label: "Quan hệ",
        value: `${totalRelationships} ${totalRelationships > 1 ? "quan hệ" : "quan hệ"}`,
      });
    }

    if (leftDataQuality.duplicateIndexSet.size > 0) {
      items.push({
        label: "Trùng trái",
        value: leftDataQuality.duplicateIndexSet.size,
        variant: "warning",
      });
    }

    if (rightDataQuality.duplicateIndexSet.size > 0) {
      items.push({
        label: "Trùng phải",
        value: rightDataQuality.duplicateIndexSet.size,
        variant: "warning",
      });
    }

    if (leftDataQuality.redundantColumns.length > 0) {
      items.push({
        label: "Cột dư trái",
        value: leftDataQuality.redundantColumns.length,
        variant: "warning",
      });
    }

    if (rightDataQuality.redundantColumns.length > 0) {
      items.push({
        label: "Cột dư phải",
        value: rightDataQuality.redundantColumns.length,
        variant: "warning",
      });
    }

    if (leftDataQuality.nameDuplicateIndexSet.size > 0) {
      items.push({
        label: "Oid trùng tên trái",
        value: leftDataQuality.nameDuplicateIndexSet.size,
        variant: "warning",
      });
    }

    if (rightDataQuality.nameDuplicateIndexSet.size > 0) {
      items.push({
        label: "Oid trùng tên phải",
        value: rightDataQuality.nameDuplicateIndexSet.size,
        variant: "warning",
      });
    }

    return items;
  }, [
    leftTable,
    rightTable,
    leftTableData,
    rightTableData,
    differenceCount,
    columnsToCompare,
    allColumns,
    leftRelationships,
    rightRelationships,
    leftDataQuality,
    rightDataQuality,
  ]);

  return (
    <div className="border-b border-border p-2 bg-muted/50">
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          {stats.map((stat, idx) => (
            <span
              key={idx}
              className={stat.variant === "primary" ? "text-primary font-medium" : stat.variant === "warning" ? "text-amber-700" : "text-muted-foreground"}
            >
              {stat.label}: {stat.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

