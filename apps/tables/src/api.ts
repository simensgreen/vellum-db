import type { TableDefinition } from "vellum-db/core/table/types";
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
  definition: TableDefinition;
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
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  rows: Record<string, unknown>[];
};

export type StatsGranularity = "day" | "week" | "month";

export type StatsBucket = {
  start: string;
  inserts: number;
  updates: number;
  deletions: number;
  reads: number;
  total: number;
  table_count: number;
  row_count: number;
  database_bytes: number;
};

export type DatabaseStatsResponse = {
  summary: {
    table_count: number;
    row_count: number;
    database_bytes: number;
  };
  retention_days: number;
  granularity: StatsGranularity;
  buckets: StatsBucket[];
};

export type ApiErrorBody = {
  type: string;
  msg?: string;
  hint?: string;
};

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (typeof body.msg === "string" && body.msg.length > 0) {
    if (typeof body.hint === "string" && body.hint.length > 0) {
      return `${body.msg} (${body.hint})`;
    }
    return body.msg;
  }
  if (typeof body.type === "string") {
    return body.type;
  }
  return `HTTP ${response.status}`;
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

export async function fetchStats(
  granularity: StatsGranularity,
): Promise<DatabaseStatsResponse> {
  const response = await vellumFetch(
    `${API_PREFIX}/stats?granularity=${encodeURIComponent(granularity)}`,
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<DatabaseStatsResponse>;
}

export type RowCommitBody = {
  insert?: Array<Record<string, unknown>>;
  update?: Record<string, Record<string, unknown>>;
  delete?: string[];
};

export type RowCommitResult = {
  table: string;
  updated: number;
  inserted: number;
  deleted: number;
};

export async function commitRows(
  tableName: string,
  body: RowCommitBody,
): Promise<RowCommitResult> {
  const response = await vellumFetch(
    `${API_PREFIX}/rows/commit?table=${encodeURIComponent(tableName)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<RowCommitResult>;
}

export type IoMode = "csv" | "json" | "jsonl" | "xlsx";

export type TableImportResult = {
  table: string;
  mode: IoMode;
  on_conflict: "abort" | "ignore" | "replace";
  inserted: number;
  ignored: number;
  replaced: number;
};

function filenameFromContentDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) {
    return fallback;
  }
  const match = /filename="([^"]+)"/.exec(header);
  return match?.[1] ?? fallback;
}

export async function exportTableFile(
  tableName: string,
  mode: IoMode,
): Promise<{ filename: string; blob: Blob }> {
  const response = await vellumFetch(
    `${API_PREFIX}/export?table=${encodeURIComponent(tableName)}&mode=${encodeURIComponent(mode)}`,
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const filename = filenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
    `${tableName}.${mode}`,
  );
  const blob = await response.blob();
  return { filename, blob };
}

export async function importTableFile(
  tableName: string,
  file: File,
  onConflict?: "abort" | "ignore" | "replace",
): Promise<TableImportResult> {
  const params = new URLSearchParams({
    table: tableName,
    filename: file.name,
  });
  if (onConflict) {
    params.set("on_conflict", onConflict);
  }
  const response = await vellumFetch(`${API_PREFIX}/import?${params}`, {
    method: "POST",
    body: file,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<TableImportResult>;
}

export async function createTable(input: {
  definition: TableDefinition;
  scope?: string;
}): Promise<unknown> {
  const params = new URLSearchParams();
  if (input.scope) {
    params.set("scope", input.scope);
  }
  const query = params.toString();
  const response = await vellumFetch(
    `${API_PREFIX}/tables${query ? `?${query}` : ""}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.definition),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function alterTable(input: {
  table: string;
  add?: Array<{
    name: string;
    slug: string;
    column: TableDefinition["columns"][number];
  }>;
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
