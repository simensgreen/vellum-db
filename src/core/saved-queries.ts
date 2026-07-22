import type { SQLQueryBindings } from "bun:sqlite";
import { getDatabase } from "../db.ts";
import { asBindings } from "../bindings.ts";
import { assertSafeIdentifier } from "../identifiers.ts";
import { pageFromRows, resolvePage } from "../pagination.ts";
import { validateAgainstSchema } from "../schema-validate.ts";
import type {
  AggregateDefinition,
  QueryDefinition,
} from "./query-compile.ts";

export type SavedQueryKind = "query" | "aggregate";

export type SavedQueryRow = {
  name: string;
  kind: SavedQueryKind;
  definition_json: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

const queryDefinitionSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    filter: { type: "object" },
    order: {
      type: "array",
      items: {
        type: "object",
        properties: {
          column: { type: "string" },
          direction: { type: "string", enum: ["asc", "desc"] },
        },
        required: ["column"],
        additionalProperties: false,
      },
    },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    columns: { type: "array", items: { type: "string" } },
  },
  required: ["table"],
  additionalProperties: false,
} as const;

const aggregateDefinitionSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    metrics: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          fn: {
            type: "string",
            enum: ["count", "sum", "avg", "min", "max"],
          },
          column: { type: "string" },
          as: { type: "string" },
        },
        required: ["fn", "as"],
        additionalProperties: false,
      },
    },
    group_by: { type: "array", items: { type: "string" } },
    filter: { type: "object" },
    having: { type: "object" },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
  },
  required: ["table", "metrics"],
  additionalProperties: false,
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

export function assertSavedDefinition(
  kind: SavedQueryKind,
  definition: unknown,
): QueryDefinition | AggregateDefinition {
  if (kind === "query") {
    validateAgainstSchema(queryDefinitionSchema, definition, "query definition");
    return definition as QueryDefinition;
  }
  validateAgainstSchema(
    aggregateDefinitionSchema,
    definition,
    "aggregate definition",
  );
  return definition as AggregateDefinition;
}

export function saveQuery(input: {
  name: string;
  kind: SavedQueryKind;
  definition: unknown;
  description?: string;
}): SavedQueryRow {
  const name = assertSafeIdentifier(input.name, "query");
  if (input.kind !== "query" && input.kind !== "aggregate") {
    throw new Error('kind must be "query" or "aggregate"');
  }
  assertSavedDefinition(input.kind, input.definition);
  const definitionJson = JSON.stringify(input.definition);
  const description = input.description ?? null;
  const timestamp = nowIso();
  const database = getDatabase();
  const existing = database
    .query<SavedQueryRow, [string]>(
      "SELECT name, kind, definition_json, description, created_at, updated_at FROM _saved_queries WHERE name = ?",
    )
    .get(name);

  if (existing) {
    database
      .query(
        "UPDATE _saved_queries SET kind = ?, definition_json = ?, description = ?, updated_at = ? WHERE name = ?",
      )
      .run(input.kind, definitionJson, description, timestamp, name);
    return {
      name,
      kind: input.kind,
      definition_json: definitionJson,
      description,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  database
    .query(
      "INSERT INTO _saved_queries (name, kind, definition_json, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(name, input.kind, definitionJson, description, timestamp, timestamp);
  return {
    name,
    kind: input.kind,
    definition_json: definitionJson,
    description,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export type ListSavedQueriesFilter = {
  kind?: SavedQueryKind;
  name_prefix?: string;
  limit?: number;
  offset?: number;
};

export function listSavedQueries(filter: ListSavedQueriesFilter = {}): {
  queries: SavedQueryRow[];
  count: number;
  limit: number;
  offset: number;
  has_more: boolean;
} {
  const { limit, offset } = resolvePage(filter.limit, filter.offset);
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filter.kind !== undefined) {
    if (filter.kind !== "query" && filter.kind !== "aggregate") {
      throw new Error('kind must be "query" or "aggregate"');
    }
    clauses.push("kind = ?");
    values.push(filter.kind);
  }
  if (filter.name_prefix !== undefined && filter.name_prefix !== "") {
    if (typeof filter.name_prefix !== "string") {
      throw new Error("name_prefix must be a string");
    }
    clauses.push("name LIKE ?");
    values.push(
      `${filter.name_prefix.replaceAll("%", "").replaceAll("_", "")}%`,
    );
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDatabase()
    .query<SavedQueryRow, SQLQueryBindings[]>(
      `SELECT name, kind, definition_json, description, created_at, updated_at FROM _saved_queries ${where} ORDER BY name LIMIT ? OFFSET ?`,
    )
    .all(...asBindings([...values, limit + 1, offset]));

  const page = pageFromRows(rows, limit, offset);
  return {
    queries: page.items,
    count: page.count,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
  };
}

export function getSavedQuery(name: string): SavedQueryRow | null {
  const queryName = assertSafeIdentifier(name, "query");
  return (
    getDatabase()
      .query<SavedQueryRow, [string]>(
        "SELECT name, kind, definition_json, description, created_at, updated_at FROM _saved_queries WHERE name = ?",
      )
      .get(queryName) ?? null
  );
}

export function deleteSavedQuery(name: string): void {
  const queryName = assertSafeIdentifier(name, "query");
  const result = getDatabase()
    .query("DELETE FROM _saved_queries WHERE name = ?")
    .run(queryName);
  if (result.changes === 0) {
    throw new Error(`Saved query "${queryName}" does not exist`);
  }
}

const PARAM_PATTERN = /^\$([a-z][a-z0-9_]*)$/;

export function substituteParams<T>(value: T, params: Record<string, unknown>): T {
  if (typeof value === "string") {
    const match = PARAM_PATTERN.exec(value);
    if (match) {
      const paramName = match[1];
      if (!paramName || !(paramName in params)) {
        throw new Error(`Missing query param "$${paramName}"`);
      }
      return params[paramName] as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteParams(item, params)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = substituteParams(nested, params);
    }
    return result as T;
  }
  return value;
}
