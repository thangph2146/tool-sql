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
    return activeFilters.every(([column, filterValue]) => {
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

      if (cellStr.trim() === filterValueTrimmed) {
        exactMatch = true;
      }

      if (displayValueTrimmed === filterValueTrimmed) {
        exactMatch = true;
      }

      if (originalIdValue !== null && originalIdValue !== undefined) {
        const originalIdStr = String(originalIdValue).trim();
        if (originalIdStr === filterValueTrimmed) {
          exactMatch = true;
        }
      }

      const comboboxFormatMatch = filterValueTrimmed.match(
        /^(.+?)\s*\(ID:\s*(.+?)\)$/
      );
      if (comboboxFormatMatch) {
        const [, filterDisplay, filterId] = comboboxFormatMatch;
        const filterDisplayTrimmed = filterDisplay.trim();
        const filterIdTrimmed = filterId.trim();

        if (originalIdValue !== null && originalIdValue !== undefined) {
          const originalIdStr = String(originalIdValue).trim();
          if (
            displayValueTrimmed === filterDisplayTrimmed &&
            originalIdStr === filterIdTrimmed
          ) {
            exactMatch = true;
          }
        }
      }

      const cellWithoutNewlines = cellStr.replace(/\r?\n/g, " ").trim();
      if (cellWithoutNewlines === filterValueTrimmed) {
        exactMatch = true;
      }

      if (exactMatch) {
        return true;
      }

      if (hasRelationship && originalIdValue !== null && originalIdValue !== undefined) {
        const originalIdStr = String(originalIdValue).trim();
        const originalIdLower = originalIdStr.toLowerCase();
        const originalIdNormalized = normalizeVietnameseText(originalIdStr);

        const displayMatches =
          displayValueNormalized.includes(filterNormalized) ||
          displayValueTrimmed.toLowerCase().includes(filterValueLower);

        const idMatches =
          originalIdStr === filterValue.trim() ||
          originalIdLower.includes(filterValueLower) ||
          originalIdNormalized.includes(filterNormalized);

        return displayMatches || idMatches;
      }

      const cellNormalized = normalizeVietnameseText(cellStr);
      return (
        cellNormalized.includes(filterNormalized) ||
        cellStr.toLowerCase().includes(filterValueLower)
      );
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

  const values = new Set<string>();

  rows.forEach((row) => {
    const cellValue = row[columnName];
    if (cellValue === null || cellValue === undefined) {
      values.add("(null)");
      return;
    }

    const cellStr = String(cellValue);

    if (hasRelationship) {
      const parts = cellStr.split(/\r?\n/);
      const displayValue = parts[0] || cellStr;
      const displayValueTrimmed = displayValue.trim();

      if (displayValueTrimmed) {
        values.add(displayValueTrimmed);
      }

      const originalIdColumn = `${columnName}_OriginalId`;
      const originalIdValue = row[originalIdColumn];
      if (originalIdValue !== null && originalIdValue !== undefined) {
        const fkStr = String(originalIdValue).trim();
        values.add(fkStr);
        if (displayValueTrimmed) {
          values.add(`${displayValueTrimmed} (ID: ${fkStr})`);
        }
        values.add(cellStr.trim());
      } else if (displayValueTrimmed) {
        values.add(cellStr.trim());
      }
    } else {
      values.add(cellStr.trim());
    }
  });

  return Array.from(values);
}

