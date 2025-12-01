"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface SingleSelectComboboxProps {
  options: string[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onSearchChange?: (search: string) => void;
}

export function SingleSelectCombobox({
  options,
  value,
  placeholder = "Chọn một giá trị...",
  loading = false,
  onChange,
  onClear,
  onSearchChange,
}: SingleSelectComboboxProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Call onSearchChange when debounced search changes
  useEffect(() => {
    if (onSearchChange) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (onSearchChange) {
      // Server-side filtering, return all options from server
      return options;
    }
    // Client-side filtering
    if (!debouncedSearch.trim()) {
      return options;
    }
    const normalizedSearch = debouncedSearch.toLowerCase();
    return options.filter((option) =>
      option.toLowerCase().includes(normalizedSearch)
    );
  }, [options, debouncedSearch, onSearchChange]);

  const handleValueChange = (newValue: string) => {
    onChange(newValue);
    setSearchTerm("");
  };

  const handleClear = () => {
    onClear();
    setSearchTerm("");
  };

  return (
    <div className="flex items-center gap-2 h-7">
      <Select value={value || undefined} onValueChange={handleValueChange}>
        <SelectTrigger className="h-7 flex-1 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent 
          className="max-h-48"
          position="popper"
          align="start"
        >
          {filteredOptions.map((option) => (
            <SelectItem
              key={option}
              value={option}
              className="text-xs"
            >
              {option}
            </SelectItem>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              {loading
                ? "Đang tải..."
                : "Không tìm thấy."}
            </div>
          )}
        </SelectContent>
      </Select>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="h-7 w-7 text-destructive hover:text-destructive/80"
          type="button"
        >
          <XCircle className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

