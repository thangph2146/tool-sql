"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DuplicateGroup } from "@/lib/utils/data-quality-utils";

interface DataQualityAlertProps {
  duplicateGroups?: DuplicateGroup[];
  duplicateIndexSet?: Set<number>;
  nameDuplicateGroups?: DuplicateGroup[];
  nameDuplicateIndexSet?: Set<number>;
  redundantColumns?: string[];
  onRowNavigate?: (rowIndex: number) => void;
  className?: string;
}

export function DataQualityAlert({
  duplicateGroups = [],
  duplicateIndexSet,
  nameDuplicateGroups = [],
  nameDuplicateIndexSet,
  redundantColumns = [],
  onRowNavigate,
  className,
}: DataQualityAlertProps) {
  const duplicateCount = duplicateIndexSet?.size ?? 0;
  const nameDuplicateCount = nameDuplicateIndexSet?.size ?? 0;
  const redundantCount = redundantColumns.length;

  const hasWarnings =
    duplicateGroups.length > 0 ||
    nameDuplicateGroups.length > 0 ||
    redundantCount > 0;

  if (!hasWarnings) {
    return null;
  }

  const renderGroupButtons = (indices: number[]) => {
    if (!onRowNavigate) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {indices.slice(0, 5).map((rowIndex) => (
          <Button
            key={`dup-btn-${rowIndex}`}
            variant="secondary"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onRowNavigate(rowIndex)}
          >
            Dòng {rowIndex + 1}
          </Button>
        ))}
        {indices.length > 5 && (
          <span className="text-muted-foreground text-[10px]">
            +{indices.length - 5} dòng khác
          </span>
        )}
      </div>
    );
  };

  return (
    <ScrollArea
      className={cn(
        "border-y border-amber-200 bg-amber-50 text-amber-900 max-h-[10dvh]",
        className
      )}
    >
      <div className="px-4 py-3 text-xs flex flex-col gap-2">
        {duplicateGroups.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="font-semibold uppercase tracking-wide text-[10px] text-amber-700">
              Duplicate rows detected
            </div>
            <div>Có {duplicateCount} dòng có nội dung trùng lặp.</div>
            <ul className="list-disc list-inside space-y-2">
              {duplicateGroups.slice(0, 3).map((group, index) => (
                <li key={`dup-${group.signature}`} className="text-[11px] space-y-1">
                  Nhóm #{index + 1}: {group.indices.length} dòng giống nhau.{" "}
                  <span className="text-muted-foreground">
                    Ví dụ:{" "}
                    {Object.entries(group.sampleRow)
                      .map(([key, value]) => `${key}: ${value ?? "∅"}`)
                      .join(", ")}
                  </span>
                  {onRowNavigate && renderGroupButtons(group.indices)}
                </li>
              ))}
              {duplicateGroups.length > 3 && (
                <li className="text-[11px] text-muted-foreground">
                  … {duplicateGroups.length - 3} nhóm khác
                </li>
              )}
            </ul>
          </div>
        )}

        {nameDuplicateGroups.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="font-semibold uppercase tracking-wide text-[10px] text-amber-700">
              Oid trùng tên
            </div>
            <div>
              Có {nameDuplicateCount} dòng có tên trùng nhau dựa trên cột Oid.
            </div>
            <ul className="list-disc list-inside space-y-2">
              {nameDuplicateGroups.slice(0, 3).map((group, index) => (
                <li key={`name-dup-${group.signature}`} className="text-[11px] space-y-1">
                  Nhóm #{index + 1}: {group.displayValue || "N/A"} •{" "}
                  {group.indices.length} dòng.
                  {onRowNavigate && renderGroupButtons(group.indices)}
                </li>
              ))}
              {nameDuplicateGroups.length > 3 && (
                <li className="text-[11px] text-muted-foreground">
                  … {nameDuplicateGroups.length - 3} nhóm khác
                </li>
              )}
            </ul>
          </div>
        )}

        {redundantColumns.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="font-semibold uppercase tracking-wide text-[10px] text-amber-700">
              Redundant columns
            </div>
            <div>
              Các cột luôn trống hoặc có cùng một giá trị:{" "}
              <span className="font-medium">
                {redundantColumns.slice(0, 5).join(", ")}
              </span>
              {redundantColumns.length > 5 && "…"}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}


