"use client";

import { Loader2, Database, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface ComparisonLoadingStateProps {
  isLoading: boolean;
  loadingStates?: {
    leftData: boolean;
    rightData: boolean;
    leftRelationships: boolean;
    rightRelationships: boolean;
  };
  hasError: boolean;
  errors?: {
    leftData?: unknown | null;
    rightData?: unknown | null;
    leftRelationships?: unknown | null;
    rightRelationships?: unknown | null;
  };
  loadingProgress?: number;
  className?: string;
}

export function ComparisonLoadingState({
  isLoading,
  loadingStates,
  hasError,
  errors,
  loadingProgress,
  className,
}: ComparisonLoadingStateProps) {
  if (isLoading) {
    const loadingItems = loadingStates
      ? [
          loadingStates.leftData && { label: "Left table data", key: "leftData" },
          loadingStates.rightData && { label: "Right table data", key: "rightData" },
          loadingStates.leftRelationships && { label: "Left relationships", key: "leftRelationships" },
          loadingStates.rightRelationships && { label: "Right relationships", key: "rightRelationships" },
        ].filter(Boolean) as Array<{ label: string; key: string }>
      : [];

    const completedItems = loadingStates
      ? [
          !loadingStates.leftData && { label: "Left table data", key: "leftData" },
          !loadingStates.rightData && { label: "Right table data", key: "rightData" },
          !loadingStates.leftRelationships && { label: "Left relationships", key: "leftRelationships" },
          !loadingStates.rightRelationships && { label: "Right relationships", key: "rightRelationships" },
        ].filter(Boolean) as Array<{ label: string; key: string }>
      : [];

    return (
      <div className={cn("flex flex-col items-center justify-center py-12 gap-6 w-full max-w-md mx-auto", className)}>
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          {loadingProgress !== undefined && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">{loadingProgress}%</span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-center gap-3 w-full">
          <span className="text-sm font-medium text-foreground">
            Loading comparison data...
          </span>
          
          {loadingProgress !== undefined && (
            <div className="w-full max-w-xs">
              <Progress value={loadingProgress} className="h-2" />
            </div>
          )}
          
          {loadingItems.length > 0 && (
            <div className="flex flex-col gap-2 text-xs w-full">
              {loadingItems.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
          
          {completedItems.length > 0 && (
            <div className="flex flex-col gap-2 text-xs w-full mt-2">
              {completedItems.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-muted-foreground opacity-60">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="line-through">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (hasError) {
    const errorItems: Array<{ label: string; message: string }> = [];
    
    if (errors?.leftData instanceof Error) {
      errorItems.push({ label: "Left table data", message: errors.leftData.message });
    }
    if (errors?.rightData instanceof Error) {
      errorItems.push({ label: "Right table data", message: errors.rightData.message });
    }
    if (errors?.leftRelationships instanceof Error) {
      errorItems.push({ label: "Left relationships", message: errors.leftRelationships.message });
    }
    if (errors?.rightRelationships instanceof Error) {
      errorItems.push({ label: "Right relationships", message: errors.rightRelationships.message });
    }

    const errorMessage = errorItems.length > 0
      ? errorItems[0].message
      : "An unknown error occurred";

    return (
      <div className={cn("flex flex-col items-center justify-center py-12 px-4 gap-4", className)}>
        <Database className="h-12 w-12 text-destructive mb-2 opacity-50" />
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-foreground">
            Error loading comparison data
          </p>
          <p className="text-xs text-muted-foreground text-center max-w-md">
            {errorMessage}
          </p>
          {errorItems.length > 1 && (
            <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-2">
              {errorItems.slice(1).map((item, idx) => (
                <span key={idx} className="text-destructive/80">
                  • {item.label}: {item.message}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

