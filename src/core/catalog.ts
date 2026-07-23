import type { Database, SQLQueryBindings } from "bun:sqlite";
import { ApiError } from "../api/errors.ts";
import { getConfig, getDatabase } from "../db.ts";
import { assertSafeIdentifier } from "../identifiers.ts";
import { pageFromRows, resolvePage } from "../pagination.ts";
import { asBindings } from "../bindings.ts";
import {
  invalidateSchemaCache,
  type JsonSchemaObject,
} from "../schema-validate.ts";
import { pruneStatsRetention, refreshStatsSnapshot } from "./stats-store.ts";
import {
  compileColumns,
  compileCreateTableSql,
  compileRowJsonSchema,
} from "./table/index.ts";
import {
  assertTableDefinition,
  type TableDefinition,
} from "./table/index.ts";
import type { CompiledColumn } from "./table/types.ts";

export type TableRow = {
  name: string;
  definition_json: string;
  schema_json: string;
  scope: string | null;
  created_at: string;
  updated_at: string;
};

export type ColumnSpec = {
  name: string;
  sqlType: "TEXT" | "INTEGER" | "REAL";
  notNull: boolean;
  jsonStored: boolean;
};

const TABLE_ROW_SELECT =
  "SELECT name, definition_json, schema_json, scope, created_at, updated_at FROM _tables";

function compiledToColumnSpec(column: CompiledColumn): ColumnSpec {
  return {
    name: column.slug,
    sqlType: column.sqlType,
    notNull: column.notNull,
    jsonStored: column.jsonStored,
  };
}

export function parseTableDefinition(table: TableRow): TableDefinition {
  return JSON.parse(table.definition_json) as TableDefinition;
}

export function buildKnownTablesMap(
  tables: TableRow[] = listTables({ limit: 10_000 }).tables,
): Map<string, TableDefinition> {
  const knownTables = new Map<string, TableDefinition>();
  for (const table of tables) {
    knownTables.set(table.name, parseTableDefinition(table));
  }
  return knownTables;
}

export function ensureMetaSchema(database: Database = getDatabase()): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS _tables (
      name TEXT PRIMARY KEY NOT NULL,
      definition_json TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS _views (
      slug TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      definition_json TEXT NOT NULL,
      description TEXT,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS _stats (
      day INTEGER PRIMARY KEY NOT NULL,
      table_count INTEGER NOT NULL DEFAULT 0,
      row_count INTEGER NOT NULL DEFAULT 0,
      database_bytes INTEGER NOT NULL DEFAULT 0,
      inserts INTEGER NOT NULL DEFAULT 0,
      updates INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0,
      reads INTEGER NOT NULL DEFAULT 0
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      migration_json TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  pruneStatsRetention();
}

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeScope(scope: unknown): string | null {
  if (scope === undefined || scope === null || scope === "") {
    return null;
  }
  if (typeof scope !== "string") {
    throw new ApiError("validation_error", "scope must be a string or null", {
      hint: "Set scope to a string matching [a-z][a-z0-9_]* or omit it",
    });
  }
  try {
    return assertSafeIdentifier(scope.trim(), "query");
  } catch {
    throw new ApiError("invalid_identifier", `Invalid scope "${scope}"`, {
      hint: "scope must match [a-z][a-z0-9_]*",
    });
  }
}

export function requireScope(
  scope: unknown,
  context: { entity: string; hint?: string },
): string {
  const normalized = normalizeScope(scope);
  if (normalized === null) {
    throw new ApiError(
      "validation_error",
      `scope is required when creating a ${context.entity}`,
      {
        hint:
          context.hint ??
          "Pass scope matching [a-z][a-z0-9_]* (query param or migration entry field)",
      },
    );
  }
  return normalized;
}

export type ListTablesFilter = {
  scope?: string | null;
  name_prefix?: string;
  limit?: number;
  offset?: number;
};

export function listTables(filter: ListTablesFilter = {}): {
  tables: TableRow[];
  count: number;
  limit: number;
  offset: number;
  has_more: boolean;
} {
  const { limit, offset } = resolvePage(filter.limit, filter.offset);
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filter.scope !== undefined) {
    const scope = normalizeScope(filter.scope);
    if (scope === null) {
      clauses.push("scope IS NULL");
    } else {
      clauses.push("scope = ?");
      values.push(scope);
    }
  }
  if (filter.name_prefix !== undefined && filter.name_prefix !== "") {
    if (typeof filter.name_prefix !== "string") {
      throw new ApiError("validation_error", "name_prefix must be a string");
    }
    clauses.push("name LIKE ?");
    values.push(`${filter.name_prefix.replaceAll("%", "").replaceAll("_", "\\_")}%`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDatabase()
    .query<TableRow, SQLQueryBindings[]>(
      `${TABLE_ROW_SELECT} ${where} ORDER BY name LIMIT ? OFFSET ?`,
    )
    .all(...asBindings([...values, limit + 1, offset]));

  const page = pageFromRows(rows, limit, offset);
  return {
    tables: page.items,
    count: page.count,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
  };
}

export function getTable(name: string): TableRow | null {
  const tableName = assertSafeIdentifier(name, "table");
  return (
    getDatabase()
      .query<TableRow, [string]>(`${TABLE_ROW_SELECT} WHERE name = ?`)
      .get(tableName) ?? null
  );
}

export function requireTable(name: string): TableRow {
  const table = getTable(name);
  if (!table) {
    throw new ApiError("not_found", `Table "${name}" does not exist`, {
      hint: "Create the table first or check the table slug",
      status: 404,
    });
  }
  return table;
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function createUserTable(
  definitionInput: TableDefinition,
  options: { scope?: string | null } = {},
): TableRow {
  const knownTables = buildKnownTablesMap();
  const definition = assertTableDefinition(definitionInput, { knownTables });
  const tableName = definition.slug;

  if (getTable(tableName)) {
    throw new ApiError("duplicate_table", `Table "${tableName}" already exists`, {
      hint: "Choose a different slug or drop the existing table",
    });
  }

  const scopeSource = Object.prototype.hasOwnProperty.call(options, "scope")
    ? options.scope
    : definition.scope;
  const scope = requireScope(scopeSource, { entity: "table" });

  const definitionJson = JSON.stringify(definition);
  const schemaJson = JSON.stringify(compileRowJsonSchema(definition, { knownTables }));
  const createSql = compileCreateTableSql(definition, { knownTables });
  const timestamp = nowIso();
  const database = getDatabase();

  database.run(createSql);
  database
    .query(
      "INSERT INTO _tables (name, definition_json, schema_json, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(tableName, definitionJson, schemaJson, scope, timestamp, timestamp);

  refreshStatsSnapshot();

  return {
    name: tableName,
    definition_json: definitionJson,
    schema_json: schemaJson,
    scope,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function dropUserTable(name: string): { name: string } {
  if (!getConfig().allowDropTable) {
    throw new ApiError(
      "forbidden",
      "Table drop is disabled (config.allowDropTable = false)",
      { status: 403 },
    );
  }
  const table = requireTable(name);
  const database = getDatabase();
  const startedTransaction = !database.inTransaction;
  if (startedTransaction) {
    database.run("BEGIN");
  }
  try {
    database.run(`DROP TABLE IF EXISTS ${quoteIdent(table.name)}`);
    database.query("DELETE FROM _tables WHERE name = ?").run(table.name);
    invalidateSchemaCache(table.schema_json);
    if (startedTransaction) {
      database.run("COMMIT");
    }
    refreshStatsSnapshot();
    return { name: table.name };
  } catch (error) {
    if (startedTransaction) {
      database.run("ROLLBACK");
    }
    throw error;
  }
}

export function alterUserTable(input: {
  table: string;
  add?: Array<{ name: string; slug: string; column: TableDefinition["columns"][number] }>;
  drop?: string[];
  scope?: string | null;
}): TableRow {
  const table = requireTable(input.table);
  const additions = input.add ?? [];
  const dropSlugs = input.drop ?? [];
  const scopeProvided = Object.prototype.hasOwnProperty.call(input, "scope");

  if (additions.length === 0 && dropSlugs.length === 0 && !scopeProvided) {
    throw new ApiError(
      "validation_error",
      "db_alter_table requires at least one of add, drop, or scope",
    );
  }

  const definition = parseTableDefinition(table);
  const dropSet = new Set(
    dropSlugs.map((slug) => assertSafeIdentifier(slug, "column")),
  );

  for (const dropSlug of dropSet) {
    if (!definition.columns.some((column) => column.slug === dropSlug)) {
      throw new ApiError("validation_error", `Column "${dropSlug}" does not exist`);
    }
  }

  const nextColumns = definition.columns.filter(
    (column) => !dropSet.has(column.slug),
  );

  for (const addition of additions) {
    const slug = assertSafeIdentifier(addition.slug, "column");
    if (nextColumns.some((column) => column.slug === slug)) {
      throw new ApiError("validation_error", `Column "${slug}" already exists`);
    }
    nextColumns.push(addition.column);
  }

  if (nextColumns.length === 0) {
    throw new ApiError("validation_error", "Cannot drop all columns from a table");
  }

  const pkSlugs = definition.columns
    .filter((column) => column.primaryKey)
    .map((column) => column.slug);
  if (pkSlugs.some((pkSlug) => dropSet.has(pkSlug))) {
    throw new ApiError("validation_error", "Cannot drop primary key columns");
  }

  const nextDefinition: TableDefinition = {
    ...definition,
    columns: nextColumns,
  };

  const knownTables = buildKnownTablesMap(
    listTables({ limit: 10_000 }).tables.filter((entry) => entry.name !== table.name),
  );
  knownTables.set(table.name, nextDefinition);
  assertTableDefinition(nextDefinition, { knownTables });

  const nextScope = scopeProvided ? normalizeScope(input.scope) : table.scope;
  const definitionJson = JSON.stringify(nextDefinition);
  const schemaJson = JSON.stringify(
    compileRowJsonSchema(nextDefinition, { knownTables }),
  );
  const database = getDatabase();
  const timestamp = nowIso();

  const startedTransaction = !database.inTransaction;
  if (startedTransaction) {
    database.run("BEGIN");
  }
  try {
    for (const addition of additions) {
      const compiled = compileColumns(nextDefinition, { knownTables }).find(
        (column) => column.slug === addition.slug,
      );
      if (!compiled) {
        throw new ApiError("validation_error", `Column "${addition.slug}" was not compiled`);
      }
      database.run(
        `ALTER TABLE ${quoteIdent(table.name)} ADD COLUMN ${quoteIdent(compiled.slug)} ${compiled.sqlType}`,
      );
    }

    if (dropSlugs.length > 0) {
      const compiledColumns = compileColumns(nextDefinition, { knownTables });
      const tempName = `_tmp_${table.name}_${Date.now()}`;
      const createTempSql = compileCreateTableSql(nextDefinition, { knownTables }).replace(
        quoteIdent(nextDefinition.slug),
        quoteIdent(tempName),
      );
      database.run(createTempSql);
      const columnNames = compiledColumns.map((column) => quoteIdent(column.slug));
      const selectList = columnNames.join(", ");
      database.run(
        `INSERT INTO ${quoteIdent(tempName)} (${selectList}) SELECT ${selectList} FROM ${quoteIdent(table.name)}`,
      );
      database.run(`DROP TABLE ${quoteIdent(table.name)}`);
      database.run(
        `ALTER TABLE ${quoteIdent(tempName)} RENAME TO ${quoteIdent(table.name)}`,
      );
    }

    database
      .query(
        "UPDATE _tables SET definition_json = ?, schema_json = ?, scope = ?, updated_at = ? WHERE name = ?",
      )
      .run(definitionJson, schemaJson, nextScope, timestamp, table.name);
    invalidateSchemaCache(table.schema_json);
    if (startedTransaction) {
      database.run("COMMIT");
    }
    refreshStatsSnapshot();

    return {
      name: table.name,
      definition_json: definitionJson,
      schema_json: schemaJson,
      scope: nextScope,
      created_at: table.created_at,
      updated_at: timestamp,
    };
  } catch (error) {
    if (startedTransaction) {
      database.run("ROLLBACK");
    }
    throw error;
  }
}

export function encodeCellValue(
  value: unknown,
  column: ColumnSpec,
): string | number | null {
  if (value === null || value === undefined) {
    if (column.notNull) {
      throw new ApiError("validation_error", `Column "${column.name}" is required`);
    }
    return null;
  }
  if (column.jsonStored) {
    return JSON.stringify(value);
  }
  if (column.sqlType === "INTEGER" && typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return String(value);
}

function propertyTypeName(
  schema: JsonSchemaObject,
  columnName: string,
): string | undefined {
  const propertySchema = schema.properties?.[columnName];
  if (propertySchema === null || typeof propertySchema !== "object") {
    return undefined;
  }
  const typeValue = (propertySchema as Record<string, unknown>).type;
  return Array.isArray(typeValue) ? String(typeValue[0]) : String(typeValue);
}

export function coerceCellValue(
  raw: unknown,
  column: ColumnSpec,
  schema: JsonSchemaObject,
): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "string" && raw.trim() === "") {
    return null;
  }

  const typeName = propertyTypeName(schema, column.name);

  if (column.jsonStored) {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(
          `Column "${column.name}" expects JSON object/array; got invalid JSON`,
        );
      }
    }
    return raw;
  }

  if (typeName === "boolean") {
    if (typeof raw === "boolean") {
      return raw;
    }
    if (typeof raw === "number") {
      return raw !== 0;
    }
    const text = String(raw).trim().toLowerCase();
    if (text === "true" || text === "1" || text === "yes") {
      return true;
    }
    if (text === "false" || text === "0" || text === "no") {
      return false;
    }
    throw new Error(`Column "${column.name}" expects a boolean`);
  }

  if (column.sqlType === "INTEGER") {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.trunc(raw);
    }
    const text = String(raw).trim();
    if (!/^-?\d+$/.test(text)) {
      throw new Error(`Column "${column.name}" expects an integer`);
    }
    return Number(text);
  }

  if (column.sqlType === "REAL") {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    const parsed = Number(String(raw).trim());
    if (!Number.isFinite(parsed)) {
      throw new Error(`Column "${column.name}" expects a number`);
    }
    return parsed;
  }

  return typeof raw === "string" ? raw : String(raw);
}

export function decodeRow(
  row: Record<string, unknown>,
  columns: ColumnSpec[],
  schema?: JsonSchemaObject,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const column of columns) {
    const raw = row[column.name];
    if (raw === null || raw === undefined) {
      result[column.name] = null;
      continue;
    }
    if (schema) {
      try {
        result[column.name] = coerceCellValue(raw, column, schema);
      } catch {
        result[column.name] = raw;
      }
      continue;
    }
    if (column.jsonStored && typeof raw === "string") {
      try {
        result[column.name] = JSON.parse(raw);
      } catch {
        result[column.name] = raw;
      }
      continue;
    }
    result[column.name] = raw;
  }
  return result;
}

export function getTableColumns(table: TableRow): ColumnSpec[] {
  const definition = parseTableDefinition(table);
  return compileColumns(definition).map(compiledToColumnSpec);
}

export function quoteIdentExport(identifier: string): string {
  return quoteIdent(identifier);
}

export function getCompiledColumns(table: TableRow): CompiledColumn[] {
  const definition = parseTableDefinition(table);
  return compileColumns(definition);
}
