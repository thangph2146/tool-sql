import { useMemo } from 'react';

interface UseComparisonLoadingStatesProps {
  leftDataLoading: boolean;
  rightDataLoading: boolean;
  leftRelationshipsLoading: boolean;
  rightRelationshipsLoading: boolean;
  leftData?: unknown;
  rightData?: unknown;
  leftRelationships?: unknown;
  rightRelationships?: unknown;
}

interface ComparisonLoadingStates {
  // Overall states
  isInitialLoading: boolean;
  isAnyLoading: boolean;
  isBothLoading: boolean;
  isPartialLoading: boolean;
  
  // Individual states
  leftDataLoading: boolean;
  rightDataLoading: boolean;
  leftRelationshipsLoading: boolean;
  rightRelationshipsLoading: boolean;
  
  // Data availability
  hasLeftData: boolean;
  hasRightData: boolean;
  hasAnyData: boolean;
  hasBothData: boolean;
  
  // Loading progress (0-100)
  loadingProgress: number;
  
  // Loading items for display
  loadingItems: string[];
}

/**
 * Hook to manage and compute all loading states for table comparison
 * Provides clean, centralized state management for better UX
 */
export function useComparisonLoadingStates({
  leftDataLoading,
  rightDataLoading,
  leftRelationshipsLoading,
  rightRelationshipsLoading,
  leftData,
  rightData,
  leftRelationships,
  rightRelationships,
}: UseComparisonLoadingStatesProps): ComparisonLoadingStates {
  return useMemo(() => {
    const hasLeftData = !!leftData;
    const hasRightData = !!rightData;
    const hasAnyData = hasLeftData || hasRightData;
    const hasBothData = hasLeftData && hasRightData;
    
    const isAnyLoading = leftDataLoading || rightDataLoading || leftRelationshipsLoading || rightRelationshipsLoading;
    const isBothLoading = leftDataLoading && rightDataLoading;
    const isPartialLoading = (leftDataLoading || rightDataLoading) && !isBothLoading;
    const isInitialLoading = !hasAnyData && isAnyLoading;
    
    // Calculate loading progress (0-100)
    let loadingProgress = 0;
    const totalSteps = 4; // leftData, rightData, leftRelationships, rightRelationships
    let completedSteps = 0;
    
    if (hasLeftData || !leftDataLoading) completedSteps++;
    if (hasRightData || !rightDataLoading) completedSteps++;
    if (leftRelationships || !leftRelationshipsLoading) completedSteps++;
    if (rightRelationships || !rightRelationshipsLoading) completedSteps++;
    
    loadingProgress = Math.round((completedSteps / totalSteps) * 100);
    
    // Build loading items list for display
    const loadingItems: string[] = [];
    if (leftDataLoading) loadingItems.push('Left table data');
    if (rightDataLoading) loadingItems.push('Right table data');
    if (leftRelationshipsLoading) loadingItems.push('Left relationships');
    if (rightRelationshipsLoading) loadingItems.push('Right relationships');
    
    return {
      isInitialLoading,
      isAnyLoading,
      isBothLoading,
      isPartialLoading,
      leftDataLoading,
      rightDataLoading,
      leftRelationshipsLoading,
      rightRelationshipsLoading,
      hasLeftData,
      hasRightData,
      hasAnyData,
      hasBothData,
      loadingProgress,
      loadingItems,
    };
  }, [
    leftDataLoading,
    rightDataLoading,
    leftRelationshipsLoading,
    rightRelationshipsLoading,
    leftData,
    rightData,
    leftRelationships,
    rightRelationships,
  ]);
}

