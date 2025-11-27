export interface DuplicateGroup {
  signature: string;
  indices: number[];
  sampleRow: Record<string, unknown>;
  column?: string;
  displayValue?: string;
}

export interface DataQualitySummary {
  duplicateGroups: DuplicateGroup[];
  duplicateIndexSet: Set<number>;
  redundantColumns: string[];
  nameDuplicateGroups: DuplicateGroup[];
  nameDuplicateIndexSet: Set<number>;
}

export interface DataQualityOptions {
  nameColumns?: string[];
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "∅";
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildSampleRow(
  row: Record<string, unknown>,
  columns: string[]
): Record<string, unknown> {
  const sample: Record<string, unknown> = {};
  columns.slice(0, 3).forEach((column) => {
    sample[column] = row[column];
  });
  return sample;
}

function extractDisplayNameParts(value: unknown): {
  normalized: string;
  original: string;
} {
  if (value === null || value === undefined) {
    return { normalized: "", original: "" };
  }
  const raw = String(value);
  const newlineIndex = raw.indexOf("\n");
  const parenIndex = raw.indexOf("(ID");
  let endIndex = raw.length;
  if (newlineIndex >= 0) {
    endIndex = Math.min(endIndex, newlineIndex);
  }
  if (parenIndex >= 0) {
    endIndex = Math.min(endIndex, parenIndex);
  }
  const display = raw.substring(0, endIndex).trim();
  return {
    normalized: display.toLowerCase(),
    original: display,
  };
}

export function analyzeDataQuality(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  options?: DataQualityOptions
): DataQualitySummary {
  const nameColumns = options?.nameColumns ?? ["Oid"];
  if (!rows || rows.length === 0 || columns.length === 0) {
    return {
      duplicateGroups: [],
      duplicateIndexSet: new Set(),
      redundantColumns: [],
      nameDuplicateGroups: [],
      nameDuplicateIndexSet: new Set(),
    };
  }

  const signatureMap = new Map<
    string,
    { indices: number[]; sampleRow: Record<string, unknown> }
  >();

  rows.forEach((row, index) => {
    const signature = columns
      .map((column) => normalizeValue(row[column]))
      .join("|");

    const existing = signatureMap.get(signature);
    if (existing) {
      existing.indices.push(index);
    } else {
      signatureMap.set(signature, {
        indices: [index],
        sampleRow: buildSampleRow(row, columns),
      });
    }
  });

  const duplicateGroups: DuplicateGroup[] = [];
  const duplicateIndexSet = new Set<number>();
  const nameSignatureMap = new Map<
    string,
    {
      indices: number[];
      sampleRow: Record<string, unknown>;
      displayValue?: string;
      column?: string;
    }
  >();

  signatureMap.forEach((value, signature) => {
    if (value.indices.length > 1) {
      duplicateGroups.push({
        signature,
        indices: value.indices,
        sampleRow: value.sampleRow,
      });
      value.indices.forEach((idx) => duplicateIndexSet.add(idx));
    }
  });

  const redundantColumns: string[] = [];

  columns.forEach((column) => {
    const uniqueValues = new Set<string>();
    rows.forEach((row) => {
      uniqueValues.add(normalizeValue(row[column]));
    });
    if (uniqueValues.size <= 1) {
      redundantColumns.push(column);
    }
  });

  rows.forEach((row, index) => {
    nameColumns.forEach((column) => {
      const { normalized, original } = extractDisplayNameParts(row[column]);
      if (!normalized) return;
      const key = `${column}:${normalized}`;
      const existing = nameSignatureMap.get(key);
      if (existing) {
        existing.indices.push(index);
      } else {
        nameSignatureMap.set(key, {
          indices: [index],
          sampleRow: {
            DisplayName: original,
            ...buildSampleRow(row, columns),
          },
          displayValue: original,
          column,
        });
      }
    });
  });

  const nameDuplicateGroups: DuplicateGroup[] = [];
  const nameDuplicateIndexSet = new Set<number>();

  nameSignatureMap.forEach((value, signature) => {
    if (value.indices.length > 1) {
      nameDuplicateGroups.push({
        signature,
        indices: value.indices,
        sampleRow: value.sampleRow,
        column: value.column,
        displayValue: value.displayValue,
      });
      value.indices.forEach((idx) => nameDuplicateIndexSet.add(idx));
    }
  });

  return {
    duplicateGroups,
    duplicateIndexSet,
    redundantColumns,
    nameDuplicateGroups,
    nameDuplicateIndexSet,
  };
}

