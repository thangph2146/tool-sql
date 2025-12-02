import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Check, XCircle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiSelectComboboxProps {
  column: string;
  options: string[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onOpenChange?: (open: boolean) => void;
  onSearchChange?: (search: string) => void;
}

export function MultiSelectCombobox({
  column,
  options,
  value,
  placeholder = "Filter by value...",
  loading = false,
  onChange,
  onClear,
  onOpenChange,
  onSearchChange,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  
  const selectedValues = useMemo(() => {
    if (!value) return [];
    return value
      .split("||")
      .map((val) => val.trim())
      .filter((val) => val.length > 0);
  }, [value]);

  // Khi có onSearchChange, không filter client-side nữa, để server filter
  // Chỉ filter client-side nếu không có onSearchChange (backward compatibility)
  // No sorting for filter options
  const normalizedOptions = useMemo(() => {
    let filtered: string[];
    
    if (onSearchChange) {
      // Server-side filtering, trả về tất cả options từ server
      filtered = options;
    } else {
      // Client-side filtering (backward compatibility)
      if (!searchTerm.trim()) {
        filtered = options;
      } else {
        const normalizedSearch = searchTerm.toLowerCase();
        filtered = options.filter((option) =>
          option.toLowerCase().includes(normalizedSearch)
        );
      }
    }
    
    // Return filtered options without sorting
    return filtered;
  }, [options, searchTerm, onSearchChange]);

  const toggleValue = (target: string, event?: React.MouseEvent) => {
    // Prevent default behavior (closing the popover)
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const normalized = target.trim();
    if (!normalized) return;
    // Chỉ cập nhật pendingValues, không gọi onChange
    if (pendingValues.includes(normalized)) {
      setPendingValues(pendingValues.filter((val) => val !== normalized));
    } else {
      setPendingValues([...pendingValues, normalized]);
    }
    setSearchTerm("");
  };

  const handleApply = () => {
    const uniqueValues = Array.from(new Set(pendingValues));
    onChange(uniqueValues.join("||"));
    setSearchTerm("");
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingValues(selectedValues);
    setSearchTerm("");
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setSearchTerm("");
    setOpen(false);
  };

  const displayValue =
    selectedValues.length > 0
      ? selectedValues.length === 1
        ? selectedValues[0]
        : `${selectedValues.length} selected`
      : "";

  return (
    <InputGroup className="h-7">
      <Popover open={open} onOpenChange={(nextOpen: boolean) => {
        if (nextOpen) {
          // Khởi tạo pendingValues khi mở popover
          setPendingValues(selectedValues);
        } else {
          // Khi đóng popover mà không áp dụng, reset về giá trị ban đầu
          setPendingValues(selectedValues);
          setSearchTerm("");
        }
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}>
        <PopoverTrigger asChild>
          <div className="flex h-7 flex-1 items-center justify-between gap-2 rounded-none border-0 px-2 text-xs cursor-pointer hover:bg-accent/50">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                className={cn(
                  "truncate",
                  displayValue
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {displayValue || placeholder}
              </span>
              {selectedValues.length > 1 && (
                <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                  {selectedValues.length}
                </Badge>
              )}
            </div>
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command className="overflow-visible">
            <CommandInput
              value={searchTerm}
              onValueChange={(value) => {
                setSearchTerm(value);
                onSearchChange?.(value);
              }}
              placeholder={`Search ${column}...`}
              className="h-8 text-xs"
            />
            <CommandList className="max-h-48 overflow-y-auto">
              <CommandEmpty className="text-xs">
                {loading
                  ? "Loading options..."
                  : "No value found. Use the search box to enter custom text."}
              </CommandEmpty>
              <CommandGroup className="overflow-visible">
                {normalizedOptions.map((option) => {
                  const isSelected = pendingValues.includes(option);
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        toggleValue(option);
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
          <div className="flex items-center justify-end gap-2 p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-7 text-xs"
              type="button"
            >
              Hủy
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleApply}
              className="h-7 text-xs"
              type="button"
            >
              Áp dụng
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {selectedValues.length > 0 && (
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

