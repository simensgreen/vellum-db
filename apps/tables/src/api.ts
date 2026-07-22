const API_PREFIX = "/v1/x/plugins/vellum-db";

export type TableSummary = {
  name: string;
  scope: string | null;
  schema: unknown;
  columns: Array<{ name: string; sqlType: string; notNull: boolean; jsonStored: boolean }>;
  created_at: string;
  updated_at: string;
};

export type TablesListResponse = {
  tables: TableSummary[];
  count: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type RowsResponse = {
  table: string;
  count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  rows: Record<string, unknown>[];
};

declare global {
  interface Window {
    vellum?: {
      fetch: (path: string, options?: RequestInit) => Promise<Response>;
      subscribe: (
        filter: { tags: readonly string[] },
        callback: (event: { tags?: string[] }) => void,
      ) => () => void;
    };
  }
}

function vellumFetch(path: string): Promise<Response> {
  if (!window.vellum?.fetch) {
    return Promise.reject(new Error("window.vellum.fetch is unavailable"));
  }
  return window.vellum.fetch(path);
}

export async function fetchTables(
  offset = 0,
  limit = 100,
): Promise<TablesListResponse> {
  const response = await vellumFetch(
    `${API_PREFIX}/tables?limit=${limit}&offset=${offset}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `HTTP ${response.status}`,
    );
  }
  return response.json() as Promise<TablesListResponse>;
}

export async function fetchRows(
  tableName: string,
  offset: number,
  limit: number,
): Promise<RowsResponse> {
  const response = await vellumFetch(
    `${API_PREFIX}/rows?table=${encodeURIComponent(tableName)}&limit=${limit}&offset=${offset}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `HTTP ${response.status}`,
    );
  }
  return response.json() as Promise<RowsResponse>;
}
