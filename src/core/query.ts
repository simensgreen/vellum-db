import type { JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../db.ts";
import { asBindings } from "../bindings.ts";
import {
  decodeRow,
  getTableColumns,
  requireTable,
} from "./catalog.ts";
import type { JsonSchemaObject } from "../schema-validate.ts";
import { pageFromRows } from "../pagination.ts";
import {
  compileCountQuery,
  compileSelectQuery,
  type OrderSpec,
  type QueryDefinition,
} from "./query-compile.ts";
import { isUserTableName, recordStatsDelta } from "./stats-store.ts";

export type { QueryDefinition, OrderSpec };

export function executeQueryDefinition(definition: QueryDefinition) {
  const table = requireTable(definition.table);
  const columns = getTableColumns(table);
  const rowSchema = JSON.parse(table.schema_json) as JsonSchemaObject;
  const compiled = compileSelectQuery(definition);
  const fetched = getDatabase()
    .query(compiled.text)
    .all(...asBindings(compiled.values)) as Record<string, unknown>[];
  const page = pageFromRows(fetched, compiled.limit, compiled.offset);
  const countCompiled = compileCountQuery(definition);
  const totalRow = getDatabase()
    .query(countCompiled.text)
    .get(...asBindings(countCompiled.values)) as { total: number };
  if (isUserTableName(table.name) && page.count > 0) {
    recordStatsDelta({ reads: page.count });
  }
  return {
    table: table.name,
    count: page.count,
    total_count: totalRow.total,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
    rows: page.items.map((row) => decodeRow(row, columns, rowSchema)),
  };
}

export function buildQueryDefinition(input: {
  table: string;
  filter?: JsonFilter;
  order?: OrderSpec[];
  limit?: number;
  offset?: number;
  columns?: string[];
}): QueryDefinition {
  return {
    table: input.table,
    filter: input.filter,
    order: input.order,
    limit: input.limit,
    offset: input.offset,
    columns: input.columns,
  };
}
