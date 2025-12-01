"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { XCircle, ChevronDown, Check } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { cn } from "@/lib/utils";

interface SingleSelectComboboxProps {
  options: string[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onSearchChange?: (search: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export function SingleSelectCombobox({
  options,
  value,
  placeholder = "Chọn một giá trị...",
  loading = false,
  onChange,
  onClear,
  onSearchChange,
  onOpenChange,
}: SingleSelectComboboxProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"alphabetical" | "newest" | "oldest">("alphabetical");
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  // Call onOpenChange when open state changes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(open);
    }
  }, [open, onOpenChange]);

  // Call onSearchChange when debounced search changes
  useEffect(() => {
    if (onSearchChange) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange]);

  // Filter and sort options
  const filteredOptions = useMemo(() => {
    let filtered: string[];
    
    if (onSearchChange) {
      // Server-side filtering, return all options from server
      filtered = options;
    } else {
      // Client-side filtering
      if (!debouncedSearch.trim()) {
        filtered = options;
      } else {
        const normalizedSearch = debouncedSearch.toLowerCase();
        filtered = options.filter((option) =>
          option.toLowerCase().includes(normalizedSearch)
        );
      }
    }
    
    // Sort options based on sortOrder
    if (sortOrder === "alphabetical") {
      return [...filtered].sort((a, b) => a.localeCompare(b));
    } else if (sortOrder === "newest") {
      // Newest = reverse order (last items first)
      return [...filtered].reverse();
    } else { // oldest
      // Oldest = original order (first items first)
      return filtered;
    }
  }, [options, debouncedSearch, onSearchChange, sortOrder]);

  const handleValueChange = (selectedValue: string) => {
    onChange(selectedValue);
    setSearchTerm("");
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setSearchTerm("");
    setOpen(false);
  };

  return (
    <InputGroup className="h-7">
      <Popover open={open} onOpenChange={(nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearchTerm("");
        }
      }}>
        <PopoverTrigger asChild>
          <div className="flex h-7 flex-1 items-center justify-between gap-2 rounded-none border-0 px-2 text-xs cursor-pointer hover:bg-accent/50">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                className={cn(
                  "truncate",
                  value
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {value || placeholder}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command className="overflow-visible">
            <CommandInput
              value={searchTerm}
              onValueChange={(val) => {
                setSearchTerm(val);
                onSearchChange?.(val);
              }}
              placeholder="Tìm kiếm..."
              className="h-8 text-xs"
            />
            {/* Sort options */}
            <div className="flex items-center gap-2 p-2 border-b">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Sắp xếp:</Label>
              <Select value={sortOrder} onValueChange={(value: "alphabetical" | "newest" | "oldest") => setSortOrder(value)}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">Chữ cái</SelectItem>
                  <SelectItem value="newest">Mới nhất</SelectItem>
                  <SelectItem value="oldest">Cũ nhất</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CommandList className="max-h-48 overflow-y-auto">
              <CommandEmpty className="text-xs">
                {loading
                  ? "Đang tải..."
                  : "Không tìm thấy. Sử dụng ô tìm kiếm để nhập văn bản tùy chỉnh."}
              </CommandEmpty>
              <CommandGroup className="overflow-visible">
                {filteredOptions.map((option) => {
                  const isSelected = value === option;
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        handleValueChange(option);
                      }}
                      className="text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-input"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate flex-1">{option}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            className="text-destructive hover:text-destructive/80"
            type="button"
          >
            <XCircle className="h-3 w-3" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

