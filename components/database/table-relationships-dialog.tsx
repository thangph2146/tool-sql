"use client";

import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Database,
  Link2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ForeignKeyInfo } from "@/lib/hooks/use-database-query";

interface TableRelationshipsDialogProps {
  relationships: ForeignKeyInfo[];
  schemaName: string;
  tableName: string;
  onTableChange?: (schema: string, table: string) => void;
  trigger: React.ReactNode;
}

export function TableRelationshipsDialog({
  relationships,
  schemaName,
  tableName,
  onTableChange,
  trigger,
}: TableRelationshipsDialogProps) {
  const [showDialog, setShowDialog] = useState(false);

  // Phân loại relationships thành outgoing và incoming
  const { outgoing, incoming } = useMemo(() => {
    const out: ForeignKeyInfo[] = [];
    const inc: ForeignKeyInfo[] = [];

    relationships.forEach((rel) => {
      const isOutgoing = rel.FK_SCHEMA === schemaName && rel.FK_TABLE === tableName;
      const isIncoming = rel.PK_SCHEMA === schemaName && rel.PK_TABLE === tableName;

      if (isOutgoing) {
        out.push(rel);
      } else if (isIncoming) {
        inc.push(rel);
      }
    });

    return { outgoing: out, incoming: inc };
  }, [relationships, schemaName, tableName]);

  // Nhóm outgoing relationships theo PK_TABLE (table đích)
  const groupedOutgoing = useMemo(() => {
    return outgoing.reduce(
      (acc, rel) => {
        const key = `${rel.PK_SCHEMA}.${rel.PK_TABLE}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(rel);
        return acc;
      },
      {} as Record<string, ForeignKeyInfo[]>
    );
  }, [outgoing]);

  // Nhóm incoming relationships theo FK_TABLE (table nguồn)
  const groupedIncoming = useMemo(() => {
    return incoming.reduce(
      (acc, rel) => {
        const key = `${rel.FK_SCHEMA}.${rel.FK_TABLE}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(rel);
        return acc;
      },
      {} as Record<string, ForeignKeyInfo[]>
    );
  }, [incoming]);

  // Tính toán initial expanded keys
  const initialExpandedKeys = useMemo(() => {
    const allKeys = new Set<string>();
    Object.keys(groupedOutgoing).forEach((key) => allKeys.add(key));
    Object.keys(groupedIncoming).forEach((key) => allKeys.add(key));
    return allKeys;
  }, [groupedOutgoing, groupedIncoming]);

  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const handleDialogOpenChange = (open: boolean) => {
    setShowDialog(open);
    if (open) {
      // Dialog mở, expand tất cả
      if (initialExpandedKeys.size > 0) {
        setExpandedTables(new Set(initialExpandedKeys));
      }
    } else {
      // Dialog đóng, reset
      setExpandedTables(new Set());
    }
  };

  const handleTableClick = (schema: string, table: string) => {
    if (onTableChange) {
      onTableChange(schema, table);
      setShowDialog(false);
    }
  };

  const handleToggleExpand = (tableKey: string) => {
    setExpandedTables((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableKey)) {
        newSet.delete(tableKey);
      } else {
        newSet.add(tableKey);
      }
      return newSet;
    });
  };

  const renderRelationshipGroup = (
    tableKey: string,
    rels: ForeignKeyInfo[],
    isOutgoing: boolean
  ) => {
    const firstRel = rels[0];
    const targetSchema = isOutgoing ? firstRel.PK_SCHEMA : firstRel.FK_SCHEMA;
    const targetTable = isOutgoing ? firstRel.PK_TABLE : firstRel.FK_TABLE;
    const isExpanded = expandedTables.has(tableKey);

    return (
      <div key={tableKey} className="space-y-3">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center gap-2 pb-2 border-b border-border">
          <button
            onClick={() => handleToggleExpand(tableKey)}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <Database className="h-4 w-4 text-primary" />
          <button
            onClick={() => handleTableClick(targetSchema, targetTable)}
            className="font-semibold text-base hover:text-primary transition-colors cursor-pointer text-left flex-1"
            title={`Click to open table ${tableKey}`}
          >
            {tableKey}
          </button>
          <Badge variant="secondary" className="text-xs">
            {rels.length} relationship{rels.length > 1 ? "s" : ""}
          </Badge>
        </div>
        {isExpanded && (
          <div className="space-y-2 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
            {rels.map((rel, index) => (
              <div
                key={`${rel.FK_NAME}-${index}`}
                className="p-3 border border-border rounded-lg bg-muted/30"
              >
                <div className="flex items-start gap-3">
                  <Link2 className="h-4 w-4 text-primary mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{rel.FK_NAME}</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">FK:</span>
                        <Badge variant="outline">
                          {rel.FK_SCHEMA}.{rel.FK_TABLE}.{rel.FK_COLUMN}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">PK:</span>
                        <Badge variant="outline">
                          {rel.PK_SCHEMA}.{rel.PK_TABLE}.{rel.PK_COLUMN}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Table Relationships</DialogTitle>
          <DialogDescription>
            Foreign key relationships for {schemaName}.{tableName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {/* Outgoing Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h3 className="font-semibold text-base">Outgoing</h3>
              <Badge variant="default" className="text-xs">
                {outgoing.length}
              </Badge>
            </div>
            <ScrollArea className="max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-6">
                {Object.entries(groupedOutgoing).map(([tableKey, rels]) =>
                  renderRelationshipGroup(tableKey, rels, true)
                )}
                {outgoing.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No outgoing relationships
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Incoming Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h3 className="font-semibold text-base">Incoming</h3>
              <Badge variant="secondary" className="text-xs">
                {incoming.length}
              </Badge>
            </div>
            <ScrollArea className="max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-6">
                {Object.entries(groupedIncoming).map(([tableKey, rels]) =>
                  renderRelationshipGroup(tableKey, rels, false)
                )}
                {incoming.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No incoming relationships
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

