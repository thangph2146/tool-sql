import { useQuery } from "@tanstack/react-query";
import type { DatabaseName } from "@/lib/db-config";
import axiosClient from "@/lib/axios-client";

interface ColumnOptionsResponse {
  success: boolean;
  data: {
    values: string[];
  };
  message?: string;
  error?: string;
}

interface UseColumnFilterOptionsParams {
  databaseName?: DatabaseName | string;
  schemaName?: string;
  tableName?: string;
  columnName?: string;
  includeReferences?: boolean;
  limit?: number;
  search?: string;
}

export function useColumnFilterOptions(
  {
    databaseName,
    schemaName,
    tableName,
    columnName,
    includeReferences = true,
    limit = 500,
    search = "",
  }: UseColumnFilterOptionsParams,
  enabled: boolean
) {
  return useQuery({
    queryKey: [
      "column-options",
      databaseName,
      schemaName,
      tableName,
      columnName,
      includeReferences,
      limit,
      search,
    ],
    queryFn: async () => {
      if (!databaseName || !schemaName || !tableName || !columnName) {
        throw new Error("Missing required parameters for column options");
      }
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
      const url = `/api/db/column-options?database=${databaseName}&schema=${encodeURIComponent(
        schemaName
      )}&table=${encodeURIComponent(
        tableName
      )}&column=${encodeURIComponent(
        columnName
      )}&includeReferences=${includeReferences ? "true" : "false"}&limit=${limit}${searchParam}`;
      const response = await axiosClient.get<ColumnOptionsResponse>(url);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled:
      enabled &&
      !!databaseName &&
      !!schemaName &&
      !!tableName &&
      !!columnName,
    // Ngăn refetch khi component re-render hoặc window focus
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

