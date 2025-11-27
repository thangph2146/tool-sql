import { normalizeColumnName } from "@/lib/utils/table-column-utils";

export interface FilterRelationships {
  FK_COLUMN: string;
  PK_COLUMN: string;
  FK_TABLE: string;
  PK_TABLE: string;
  FK_SCHEMA?: string;
  PK_SCHEMA?: string;
  FK_NAME?: string;
}

export interface FilterOptions {
  includeReferences?: boolean;
  relationships?: FilterRelationships[];
}

/**
 * Normalize Vietnamese text by removing diacritics for better search matching
 * Handles Vietnamese characters like: ạ, ả, ã, á, à, ă, ằ, ắ, ẳ, ẵ, ặ, â, ầ, ấ, ẩ, ẫ, ậ, etc.
 */
export function normalizeVietnameseText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function filterTableRows<T extends Record<string, unknown>>(
  rows: T[] = [],
  filters: Record<string, string> = {},
  options: FilterOptions = {}
): T[] {
  if (!rows || rows.length === 0) return [];

  const activeFilters = Object.entries(filters).filter(
    ([, value]) => value?.trim() !== ""
  );
  if (activeFilters.length === 0) return rows;

  const { includeReferences = false, relationships = [] } = options;

  return rows.filter((row) => {
    return activeFilters.every(([column, rawFilterValue]) => {
      const filterValues = rawFilterValue
        .split("||")
        .map((val) => val.trim())
        .filter((val) => val.length > 0);

      if (filterValues.length === 0) {
        return true;
      }

      const matchesSingleValue = (filterValue: string): boolean => {
        const cellValue = row[column];
        const filterNormalized = normalizeVietnameseText(filterValue);
        const filterValueLower = filterValue.toLowerCase().trim();

      if (cellValue === null || cellValue === undefined) {
        return (
          filterNormalized === "null" ||
          filterNormalized === "" ||
          filterValueLower === "(null)"
        );
      }

        const cellStr = String(cellValue);
        const hasRelationship =
          includeReferences &&
          relationships.some(
            (rel) => normalizeColumnName(rel.FK_COLUMN) === normalizeColumnName(column)
          );

        const parts = cellStr.split(/\r?\n/);
        const displayValue = parts[0] || cellStr;
        const displayValueNormalized = normalizeVietnameseText(displayValue);
        const displayValueTrimmed = displayValue.trim();

        const originalIdColumn = `${column}_OriginalId`;
        const originalIdValue = row[originalIdColumn];

        const filterValueTrimmed = filterValue.trim();
        let exactMatch = false;

        // Exact match với cell value (bao gồm newline)
        if (cellStr.trim() === filterValueTrimmed) {
          exactMatch = true;
        }

        // Exact match với display value (phần trước newline)
        // Khi filter chỉ có tên (không có ID), match với tất cả rows có cùng display value
        // Điều này đảm bảo khi có nhiều người cùng tên nhưng khác ID, tất cả sẽ được trả về
        if (displayValueTrimmed === filterValueTrimmed) {
          exactMatch = true;
        }
        
        // Match display value sau khi normalize newline trong filter
        const filterDisplayOnlyForExact = filterValueTrimmed.split(/\r?\n/)[0]?.trim() || filterValueTrimmed;
        if (displayValueTrimmed === filterDisplayOnlyForExact) {
          exactMatch = true;
        }
        
        // Nếu filter chỉ có tên (không có format ID), match với tất cả rows có cùng display value
        // Bỏ qua việc kiểm tra ID để match với tất cả rows có cùng tên
        const hasIdInFilter = filterValueTrimmed.includes("(ID:");
        if (!hasIdInFilter && displayValueTrimmed === filterValueTrimmed) {
          exactMatch = true;
        }

        // Exact match với OriginalId
        if (originalIdValue !== null && originalIdValue !== undefined) {
          const originalIdStr = String(originalIdValue).trim();
          if (originalIdStr === filterValueTrimmed) {
            exactMatch = true;
          }
        }

        // Match với format "Display (ID: xxx)" - xử lý cả trường hợp có và không có newline trong filter
        const comboboxFormatMatch = filterValueTrimmed.match(
          /^(.+?)\s*\(ID:\s*(.+?)\)$/
        );
        if (comboboxFormatMatch) {
          const [, filterDisplay, filterId] = comboboxFormatMatch;
          const filterDisplayTrimmed = filterDisplay.trim();
          const filterIdTrimmed = filterId.trim();

          if (originalIdValue !== null && originalIdValue !== undefined) {
            const originalIdStr = String(originalIdValue).trim();
            // Match display value và ID (exact) - chỉ match với row có đúng ID
            if (
              displayValueTrimmed === filterDisplayTrimmed &&
              originalIdStr === filterIdTrimmed
            ) {
              exactMatch = true;
            }
            // Match với cell value sau khi normalize newline
            const cellNormalized = cellStr.replace(/\r?\n/g, " ").trim();
            const filterNormalized = `${filterDisplayTrimmed} (ID: ${filterIdTrimmed})`;
            if (cellNormalized === filterNormalized) {
              exactMatch = true;
            }
          }
        } else {
          // Khi filter KHÔNG có format "Display (ID: xxx)" (chỉ có tên hoặc chỉ có ID)
          // Nếu filter chỉ có tên và match với display value, đã được xử lý ở trên (line 93-95)
          // Nếu filter có newline nhưng không có format ID, normalize và so sánh
          const filterWithoutNewlines = filterValueTrimmed.replace(/\r?\n/g, " ").trim();
          if (displayValueTrimmed === filterWithoutNewlines) {
            exactMatch = true;
          }
        }

        // Match cell value sau khi thay newline bằng space
        const cellWithoutNewlines = cellStr.replace(/\r?\n/g, " ").trim();
        if (cellWithoutNewlines === filterValueTrimmed) {
          exactMatch = true;
        }

        // Match filter value sau khi thay newline bằng space với cell value
        const filterWithoutNewlines = filterValueTrimmed.replace(/\r?\n/g, " ").trim();
        if (cellWithoutNewlines === filterWithoutNewlines) {
          exactMatch = true;
        }

        // Match filter value sau khi thay newline bằng space với cell value (exact)
        if (cellStr.replace(/\r?\n/g, " ").trim() === filterWithoutNewlines) {
          exactMatch = true;
        }

        if (exactMatch) {
          return true;
        }

        if (hasRelationship && originalIdValue !== null && originalIdValue !== undefined) {
          const originalIdStr = String(originalIdValue).trim();
          const originalIdLower = originalIdStr.toLowerCase();
          const originalIdNormalized = normalizeVietnameseText(originalIdStr);

          // Match với display value (có thể có newline trong filter)
          const filterDisplayOnly = filterValueTrimmed.split(/\r?\n/)[0]?.trim() || filterValueTrimmed;
          const filterDisplayNormalized = normalizeVietnameseText(filterDisplayOnly);
          const filterDisplayLower = filterDisplayOnly.toLowerCase();

          const displayMatches =
            displayValueNormalized.includes(filterDisplayNormalized) ||
            displayValueTrimmed.toLowerCase().includes(filterDisplayLower) ||
            displayValueNormalized.includes(filterNormalized) ||
            displayValueTrimmed.toLowerCase().includes(filterValueLower);

          const idMatches =
            originalIdStr === filterValue.trim() ||
            originalIdLower.includes(filterValueLower) ||
            originalIdNormalized.includes(filterNormalized);

          return displayMatches || idMatches;
        }

        // Match partial với cell value (có thể có newline trong filter)
        const filterDisplayOnlyForPartial = filterValueTrimmed.split(/\r?\n/)[0]?.trim() || filterValueTrimmed;
        const filterDisplayNormalized = normalizeVietnameseText(filterDisplayOnlyForPartial);
        const filterDisplayLower = filterDisplayOnlyForPartial.toLowerCase();

        const cellNormalized = normalizeVietnameseText(cellStr);
        return (
          cellNormalized.includes(filterDisplayNormalized) ||
          cellStr.toLowerCase().includes(filterDisplayLower) ||
          cellNormalized.includes(filterNormalized) ||
          cellStr.toLowerCase().includes(filterValueLower)
        );
      };

      return filterValues.some(matchesSingleValue);
    });
  });
}

interface CollectColumnValuesArgs {
  rows: Record<string, unknown>[];
  columnName: string;
  includeReferences?: boolean;
  relationships?: FilterRelationships[];
}

export function collectColumnUniqueValues({
  rows = [],
  columnName,
  includeReferences = false,
  relationships = [],
}: CollectColumnValuesArgs): string[] {
  if (!rows || rows.length === 0 || !columnName) {
    return [];
  }

  const normalizedColumn = normalizeColumnName(columnName);
  const hasRelationship =
    includeReferences &&
    relationships.some(
      (rel) => normalizeColumnName(rel.FK_COLUMN) === normalizedColumn
    );

  // Sử dụng Map với key là OriginalId (hoặc cellValue) để đảm bảo mỗi row chỉ có 1 option
  const valuesMap = new Map<string, string>();

  rows.forEach((row) => {
    const cellValue = row[columnName];
    if (cellValue === null || cellValue === undefined) {
      valuesMap.set("__null__", "(null)");
      return;
    }

    const cellStr = String(cellValue);

    if (hasRelationship) {
      const originalIdColumn = `${columnName}_OriginalId`;
      const originalIdValue = row[originalIdColumn];
      
      if (originalIdValue !== null && originalIdValue !== undefined) {
        const fkStr = String(originalIdValue).trim();
        // Sử dụng OriginalId làm key để đảm bảo mỗi row chỉ có 1 option
        if (!valuesMap.has(fkStr)) {
          const parts = cellStr.split(/\r?\n/);
          const displayValue = parts[0] || cellStr;
          const displayValueTrimmed = displayValue.trim();
          
          // Chỉ thêm 1 option duy nhất: format "Display (ID: xxx)" hoặc cellStr nếu không có display
          if (displayValueTrimmed) {
            valuesMap.set(fkStr, `${displayValueTrimmed} (ID: ${fkStr})`);
          } else {
            valuesMap.set(fkStr, cellStr.trim());
          }
        }
      } else {
        // Nếu không có OriginalId, sử dụng cellStr làm key
        const cellKey = cellStr.trim();
        if (!valuesMap.has(cellKey)) {
          valuesMap.set(cellKey, cellKey);
        }
      }
    } else {
      // Không có relationship, sử dụng cellStr làm key
      const cellKey = cellStr.trim();
      if (!valuesMap.has(cellKey)) {
        valuesMap.set(cellKey, cellKey);
      }
    }
  });

  return Array.from(valuesMap.values());
}

