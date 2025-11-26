import { useEffect, useState, useRef, useMemo } from "react";

/**
 * Custom hook to debounce a value
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef<T>(value);

  // Serialize value to string for stable comparison (handles objects, arrays, etc.)
  // This ensures useEffect only runs when the actual content changes, not just the reference
  const valueString = useMemo(() => {
    try {
      return JSON.stringify(value);
    } catch {
      // Fallback to string conversion if JSON.stringify fails
      return String(value);
    }
  }, [value]);

  useEffect(() => {
    // Update ref to track current value (for use in timeout callback)
    valueRef.current = value;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Set up a timer to update the debounced value after the delay
    timeoutRef.current = setTimeout(() => {
      // Use valueRef.current to get the latest value at the time of timeout
      setDebouncedValue(valueRef.current);
      timeoutRef.current = null;
    }, delay);

    // Clean up the timer if value changes before delay completes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueString, delay]); 

  return debouncedValue;
}

