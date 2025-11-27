"use client";

import { X, GitCompare } from "lucide-react";
import type { DatabaseName } from "@/lib/db-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SelectedTable {
  databaseName: DatabaseName;
  schema: string;
  table: string;
}

interface SelectedTablesBannerProps {
  leftTable: SelectedTable | null;
  rightTable: SelectedTable | null;
  onClear?: () => void;
  onRemoveTable?: (position: "left" | "right") => void;
}

export function SelectedTablesBanner({
  leftTable,
  rightTable,
  onClear,
  onRemoveTable,
}: SelectedTablesBannerProps) {
  if (!leftTable && !rightTable) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GitCompare className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">
            Tables selected for comparison:
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Left Table (1st) */}
          {leftTable && (
            <Badge
              variant="outline"
              className="gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 hover:bg-blue-500/20"
            >
              <span className="font-semibold text-xs">1st:</span>
              <span className="truncate max-w-[200px] text-xs">
                {leftTable.databaseName} / {leftTable.schema}.{leftTable.table}
              </span>
              {onRemoveTable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveTable("left")}
                  className="h-4 w-4 ml-1 hover:bg-blue-500/30 -mr-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          )}

          {/* Right Table (2nd) */}
          {rightTable && (
            <Badge
              variant="outline"
              className="gap-2 px-3 py-1.5 bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 hover:bg-green-500/20"
            >
              <span className="font-semibold text-xs">2nd:</span>
              <span className="truncate max-w-[200px] text-xs">
                {rightTable.databaseName} / {rightTable.schema}.{rightTable.table}
              </span>
              {onRemoveTable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveTable("right")}
                  className="h-4 w-4 ml-1 hover:bg-green-500/30 -mr-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          )}

          {/* Clear All Button */}
          {onClear && (leftTable || rightTable) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

