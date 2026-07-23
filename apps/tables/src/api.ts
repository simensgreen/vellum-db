import { vellumFetch } from "./platform/bridge.ts";

const API_PREFIX = "/v1/x/plugins/vellum-db";

export type ColumnSpec = {
  name: string;
  sqlType: "TEXT" | "INTEGER" | "REAL";
  notNull: boolean;
  jsonStored: boolean;
};

export type TableSummary = {
  name: string;
  scope: string | null;
  schema: unknown;
  columns: ColumnSpec[];
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

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
}

export async function fetchTables(
  offset = 0,
  limit = 100,
): Promise<TablesListResponse> {
  const response = await vellumFetch(
    `${API_PREFIX}/tables?limit=${limit}&offset=${offset}`,
  );
  if (!response.ok) {
    throw new Error(await readError(response));
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
    throw new Error(await readError(response));
  }
  return response.json() as Promise<RowsResponse>;
}

export async function createTable(input: {
  name: string;
  schema: unknown;
  scope?: string;
}): Promise<unknown> {
  const params = new URLSearchParams({ name: input.name });
  if (input.scope) {
    params.set("scope", input.scope);
  }
  const response = await vellumFetch(`${API_PREFIX}/tables?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.schema),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function alterTable(input: {
  table: string;
  add?: Array<{ name: string; schema: unknown }>;
  drop?: string[];
  scope?: string | null;
}): Promise<unknown> {
  const params = new URLSearchParams({ table: input.table });
  if (input.scope !== undefined) {
    if (input.scope === null) {
      params.set("scope", "");
    } else {
      params.set("scope", input.scope);
    }
  }
  const body: Record<string, unknown> = {};
  if (input.add && input.add.length > 0) {
    body.add = input.add;
  }
  if (input.drop && input.drop.length > 0) {
    body.drop = input.drop;
  }
  const response = await vellumFetch(`${API_PREFIX}/tables/alter?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}
