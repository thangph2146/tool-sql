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
import { Select, SelectContent, SelectTrigger } from "@/components/ui/select";
import { Check, ChevronDown, XCircle } from "lucide-react";

interface FilterComboboxProps {
  column: string;
  options: string[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function FilterCombobox({
  column,
  options,
  value,
  placeholder = "Filter by value...",
  loading = false,
  onChange,
  onClear,
  onOpenChange,
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return options;
    }
    const normalizedSearch = searchTerm.toLowerCase();
    return options.filter((option) =>
      option.toLowerCase().includes(normalizedSearch)
    );
  }, [options, searchTerm]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    onClear();
    setSearchTerm("");
    setOpen(false);
  };

  const hasCustomOption =
    searchTerm.trim().length > 0 &&
    !options.some(
      (option) => option.toLowerCase() === searchTerm.trim().toLowerCase()
    );

  return (
    <InputGroup className="h-7">
      <Select
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          onOpenChange?.(nextOpen);
        }}
      >
        <SelectTrigger className="flex h-7 flex-1 items-center justify-between gap-2 rounded-none border-0 px-2 text-xs shadow-none focus-visible:ring-0">
          <span
            className={
              value ? "text-foreground truncate" : "text-muted-foreground"
            }
          >
            {value || placeholder}
          </span>
        </SelectTrigger>
        <SelectContent className="p-0" align="start" position="popper">
          <Command className="w-[var(--radix-select-trigger-width)]">
            <CommandInput
              value={searchTerm}
              onValueChange={setSearchTerm}
              placeholder={`Search ${column}...`}
              className="h-8 text-xs"
            />
            <CommandList className="max-h-48">
              <CommandEmpty className="text-xs">
                {loading
                  ? "Loading options..."
                  : "No value found. Use the search box to enter custom text."}
              </CommandEmpty>
              <CommandGroup>
                {normalizedOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                    className="text-xs"
                  >
                    {option}
                    {value === option && (
                      <Check className="ml-auto h-3 w-3 opacity-70" />
                    )}
                  </CommandItem>
                ))}
                {hasCustomOption && (
                  <CommandItem
                    value={searchTerm.trim()}
                    onSelect={() => handleSelect(searchTerm.trim())}
                    className="text-xs italic text-muted-foreground"
                  >
                    Use &ldquo;{searchTerm.trim()}&rdquo;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </SelectContent>
      </Select>
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

