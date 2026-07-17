import type { Database, SQLQueryBindings } from "bun:sqlite";
import { getConfig, getDatabase } from "./db.ts";
import { assertSafeIdentifier } from "./identifiers.ts";
import { pageFromRows, resolvePage } from "./pagination.ts";
import { asBindings } from "./bindings.ts";
import {
  assertTableJsonSchema,
  invalidateSchemaCache,
  type JsonSchemaObject,
} from "./schema-validate.ts";

export type TableRow = {
  name: string;
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

function propertyToColumn(
  propertyName: string,
  propertySchema: unknown,
  required: Set<string>,
): ColumnSpec {
  const name = assertSafeIdentifier(propertyName, "column");
  const schema =
    propertySchema !== null && typeof propertySchema === "object"
      ? (propertySchema as Record<string, unknown>)
      : {};
  const typeValue = schema.type;
  const typeName = Array.isArray(typeValue) ? typeValue[0] : typeValue;
  let sqlType: ColumnSpec["sqlType"] = "TEXT";
  let jsonStored = false;
  if (typeName === "integer") {
    sqlType = "INTEGER";
  } else if (typeName === "number") {
    sqlType = "REAL";
  } else if (typeName === "boolean") {
    sqlType = "INTEGER";
  } else if (typeName === "object" || typeName === "array") {
    sqlType = "TEXT";
    jsonStored = true;
  } else {
    sqlType = "TEXT";
  }
  return {
    name,
    sqlType,
    notNull: required.has(propertyName),
    jsonStored,
  };
}

export function schemaToColumns(schema: JsonSchemaObject): ColumnSpec[] {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  return Object.entries(properties).map(([propertyName, propertySchema]) =>
    propertyToColumn(propertyName, propertySchema, required),
  );
}

export function ensureMetaSchema(database: Database = getDatabase()): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS _tables (
      name TEXT PRIMARY KEY NOT NULL,
      schema_json TEXT NOT NULL,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS _saved_queries (
      name TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      definition_json TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  ensureColumn(database, "_tables", "scope", "TEXT");
}

function ensureColumn(
  database: Database,
  tableName: string,
  columnName: string,
  columnType: string,
): void {
  const columns = database
    .query<{ name: string }, []>(`PRAGMA table_info(${tableName})`)
    .all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  database.run(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`,
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeScope(scope: unknown): string | null {
  if (scope === undefined || scope === null || scope === "") {
    return null;
  }
  if (typeof scope !== "string") {
    throw new Error("scope must be a string or null");
  }
  return assertSafeIdentifier(scope.trim(), "query");
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
      throw new Error("name_prefix must be a string");
    }
    clauses.push("name LIKE ?");
    values.push(`${filter.name_prefix.replaceAll("%", "").replaceAll("_", "\\_")}%`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDatabase()
    .query<TableRow, SQLQueryBindings[]>(
      `SELECT name, schema_json, scope, created_at, updated_at FROM _tables ${where} ORDER BY name LIMIT ? OFFSET ?`,
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
      .query<TableRow, [string]>(
        "SELECT name, schema_json, scope, created_at, updated_at FROM _tables WHERE name = ?",
      )
      .get(tableName) ?? null
  );
}

export function requireTable(name: string): TableRow {
  const table = getTable(name);
  if (!table) {
    throw new Error(`Table "${name}" does not exist`);
  }
  return table;
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function createTableSql(tableName: string, columns: ColumnSpec[]): string {
  const columnDefs = [
    '"id" TEXT PRIMARY KEY NOT NULL',
    ...columns.map((column) => {
      const nullSql = column.notNull ? " NOT NULL" : "";
      return `${quoteIdent(column.name)} ${column.sqlType}${nullSql}`;
    }),
  ];
  return `CREATE TABLE ${quoteIdent(tableName)} (${columnDefs.join(", ")})`;
}

export function createUserTable(
  name: string,
  schemaInput: unknown,
  options: { scope?: string | null } = {},
): TableRow {
  const tableName = assertSafeIdentifier(name, "table");
  if (getTable(tableName)) {
    throw new Error(`Table "${tableName}" already exists`);
  }
  const schema = assertTableJsonSchema(schemaInput);
  const columns = schemaToColumns(schema);
  if (columns.length === 0) {
    throw new Error("Table schema must define at least one property");
  }
  const scope = normalizeScope(options.scope);
  const schemaJson = JSON.stringify(schema);
  const timestamp = nowIso();
  const database = getDatabase();
  const createSql = createTableSql(tableName, columns);
  database.run(createSql);
  database
    .query(
      "INSERT INTO _tables (name, schema_json, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(tableName, schemaJson, scope, timestamp, timestamp);
  return {
    name: tableName,
    schema_json: schemaJson,
    scope,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function dropUserTable(name: string): { name: string } {
  if (!getConfig().allowDropTable) {
    throw new Error(
      'db_drop_table is disabled (config.allowDropTable = false)',
    );
  }
  const table = requireTable(name);
  const database = getDatabase();
  database.run("BEGIN");
  try {
    database.run(`DROP TABLE IF EXISTS ${quoteIdent(table.name)}`);
    database
      .query("DELETE FROM _tables WHERE name = ?")
      .run(table.name);
    invalidateSchemaCache(table.schema_json);
    database.run("COMMIT");
    return { name: table.name };
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
}

function mergeSchemaAdd(
  schema: JsonSchemaObject,
  additions: Array<{ name: string; schema: unknown }>,
): JsonSchemaObject {
  const properties = { ...(schema.properties ?? {}) };
  const required = [...(schema.required ?? [])];
  for (const addition of additions) {
    const columnName = assertSafeIdentifier(addition.name, "column");
    if (columnName === "id" || properties[columnName]) {
      throw new Error(`Column "${columnName}" already exists or is reserved`);
    }
    if (
      addition.schema === null ||
      typeof addition.schema !== "object" ||
      Array.isArray(addition.schema)
    ) {
      throw new Error(`Invalid schema for column "${columnName}"`);
    }
    properties[columnName] = addition.schema;
  }
  return {
    ...schema,
    type: "object",
    properties,
    required,
  };
}

function mergeSchemaDrop(
  schema: JsonSchemaObject,
  dropNames: string[],
): JsonSchemaObject {
  const properties = { ...(schema.properties ?? {}) };
  const dropSet = new Set(
    dropNames.map((name) => assertSafeIdentifier(name, "column")),
  );
  for (const dropName of dropSet) {
    if (dropName === "id") {
      throw new Error('Cannot drop reserved column "id"');
    }
    if (!properties[dropName]) {
      throw new Error(`Column "${dropName}" does not exist`);
    }
    delete properties[dropName];
  }
  const required = (schema.required ?? []).filter(
    (name) => !dropSet.has(name),
  );
  if (Object.keys(properties).length === 0) {
    throw new Error("Cannot drop all columns from a table");
  }
  return {
    ...schema,
    type: "object",
    properties,
    required,
  };
}

export function alterUserTable(input: {
  table: string;
  add?: Array<{ name: string; schema: unknown }>;
  drop?: string[];
  scope?: string | null;
}): TableRow {
  const table = requireTable(input.table);
  const add = input.add ?? [];
  const drop = input.drop ?? [];
  const scopeProvided = Object.prototype.hasOwnProperty.call(input, "scope");
  if (add.length === 0 && drop.length === 0 && !scopeProvided) {
    throw new Error(
      "db_alter_table requires at least one of add, drop, or scope",
    );
  }
  const previousSchema = assertTableJsonSchema(JSON.parse(table.schema_json));
  let nextSchema = previousSchema;
  if (add.length > 0) {
    nextSchema = mergeSchemaAdd(nextSchema, add);
  }
  if (drop.length > 0) {
    nextSchema = mergeSchemaDrop(nextSchema, drop);
  }
  assertTableJsonSchema(nextSchema);
  const nextScope = scopeProvided
    ? normalizeScope(input.scope)
    : table.scope;
  const database = getDatabase();
  const timestamp = nowIso();

  database.run("BEGIN");
  try {
    for (const addition of add) {
      const column = propertyToColumn(
        addition.name,
        addition.schema,
        new Set(),
      );
      database.run(
        `ALTER TABLE ${quoteIdent(table.name)} ADD COLUMN ${quoteIdent(column.name)} ${column.sqlType}`,
      );
    }

    if (drop.length > 0) {
      const keepColumns = schemaToColumns(nextSchema);
      const tempName = `_tmp_${table.name}_${Date.now()}`;
      database.run(createTableSql(tempName, keepColumns));
      const keepNames = keepColumns.map((column) => column.name);
      const selectList = ["id", ...keepNames]
        .map((name) => quoteIdent(name))
        .join(", ");
      database.run(
        `INSERT INTO ${quoteIdent(tempName)} (${selectList}) SELECT ${selectList} FROM ${quoteIdent(table.name)}`,
      );
      database.run(`DROP TABLE ${quoteIdent(table.name)}`);
      database.run(
        `ALTER TABLE ${quoteIdent(tempName)} RENAME TO ${quoteIdent(table.name)}`,
      );
    }

    const schemaJson = JSON.stringify(nextSchema);
    database
      .query(
        "UPDATE _tables SET schema_json = ?, scope = ?, updated_at = ? WHERE name = ?",
      )
      .run(schemaJson, nextScope, timestamp, table.name);
    invalidateSchemaCache(table.schema_json);
    database.run("COMMIT");
    return {
      name: table.name,
      schema_json: schemaJson,
      scope: nextScope,
      created_at: table.created_at,
      updated_at: timestamp,
    };
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
}

export function encodeCellValue(
  value: unknown,
  column: ColumnSpec,
): string | number | null {
  if (value === null || value === undefined) {
    if (column.notNull) {
      throw new Error(`Column "${column.name}" is required`);
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

export function decodeRow(
  row: Record<string, unknown>,
  columns: ColumnSpec[],
): Record<string, unknown> {
  const result: Record<string, unknown> = { id: row.id };
  for (const column of columns) {
    const raw = row[column.name];
    if (raw === null || raw === undefined) {
      result[column.name] = null;
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
  const schema = assertTableJsonSchema(JSON.parse(table.schema_json));
  return schemaToColumns(schema);
}

export function quoteIdentExport(identifier: string): string {
  return quoteIdent(identifier);
}
