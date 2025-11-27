"use client";

import { Loader2, Database } from "lucide-react";
import { cn } from "@/lib/utils";

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
  className?: string;
}

export function ComparisonLoadingState({
  isLoading,
  loadingStates,
  hasError,
  errors,
  className,
}: ComparisonLoadingStateProps) {
  if (isLoading) {
    const loadingItems = loadingStates
      ? [
          loadingStates.leftData && "Dữ liệu bảng trái",
          loadingStates.rightData && "Dữ liệu bảng phải",
          loadingStates.leftRelationships && "Quan hệ bảng trái",
          loadingStates.rightRelationships && "Quan hệ bảng phải",
        ].filter(Boolean)
      : [];

    return (
      <div className={cn("flex flex-col items-center justify-center py-12 gap-4", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            Đang tải dữ liệu so sánh...
          </span>
          {loadingItems.length > 0 && (
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {loadingItems.map((item, idx) => (
                <span key={idx}>• {item}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (hasError) {
    const errorMessage =
      errors?.leftData instanceof Error
        ? errors.leftData.message
        : errors?.rightData instanceof Error
        ? errors.rightData.message
        : errors?.leftRelationships instanceof Error
        ? `Lỗi quan hệ bảng trái: ${errors.leftRelationships.message}`
        : errors?.rightRelationships instanceof Error
        ? `Lỗi quan hệ bảng phải: ${errors.rightRelationships.message}`
        : "Đã xảy ra lỗi không xác định";

    return (
      <div className={cn("flex flex-col items-center justify-center py-12 px-4 gap-4", className)}>
        <Database className="h-12 w-12 text-destructive mb-4 opacity-50" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            Lỗi khi tải dữ liệu bảng
          </p>
          <p className="text-xs text-muted-foreground text-center max-w-md">
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

