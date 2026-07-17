import { compileFilter, sql, type JsonFilter } from "@truto/sqlite-builder";
import { getConfig } from "./db.ts";
import {
  getTableColumns,
  quoteIdentExport,
  requireTable,
  type ColumnSpec,
} from "./catalog.ts";
import { assertSafeIdentifier } from "./identifiers.ts";

export type OrderSpec = {
  column: string;
  direction?: "asc" | "desc";
};

export type QueryDefinition = {
  table: string;
  filter?: JsonFilter;
  order?: OrderSpec[];
  limit?: number;
  offset?: number;
  columns?: string[];
};

export type AggregateMetric = {
  fn: "count" | "sum" | "avg" | "min" | "max";
  column?: string;
  as: string;
};

export type AggregateDefinition = {
  table: string;
  metrics: AggregateMetric[];
  group_by?: string[];
  filter?: JsonFilter;
  having?: JsonFilter;
  limit?: number;
  offset?: number;
};

function columnSet(columns: ColumnSpec[]): Set<string> {
  return new Set(columns.map((column) => column.name));
}

function assertKnownColumns(
  names: string[],
  known: Set<string>,
  label: string,
): void {
  for (const name of names) {
    assertSafeIdentifier(name, "column");
    if (name !== "id" && !known.has(name)) {
      throw new Error(`Unknown ${label} column "${name}"`);
    }
  }
}

function clampLimit(limit: number | undefined): number {
  const maxRows = getConfig().maxRowsPerQuery;
  if (limit === undefined) {
    return maxRows;
  }
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("limit must be a positive number");
  }
  return Math.min(Math.floor(limit), maxRows);
}

export function compileSelectQuery(definition: QueryDefinition): {
  text: string;
  values: unknown[];
  limit: number;
  offset: number;
} {
  const table = requireTable(definition.table);
  const columns = getTableColumns(table);
  const known = columnSet(columns);
  known.add("id");

  const selectColumns =
    definition.columns && definition.columns.length > 0
      ? definition.columns
      : ["id", ...columns.map((column) => column.name)];
  assertKnownColumns(selectColumns, known, "select");

  const selectSql = sql.join(
    selectColumns.map((name) => sql.ident(name)),
    ", ",
  );
  const fromIdent = sql.ident(table.name);

  let query = sql`SELECT ${selectSql} FROM ${fromIdent}`;
  const values: unknown[] = [...query.values];
  let text = query.text;

  if (definition.filter && Object.keys(definition.filter).length > 0) {
    const filterResult = compileFilter(definition.filter);
    text += ` WHERE ${filterResult.text}`;
    values.push(...filterResult.values);
  }

  if (definition.order && definition.order.length > 0) {
    const orderParts: string[] = [];
    for (const order of definition.order) {
      assertKnownColumns([order.column], known, "order");
      const direction =
        order.direction === "desc" ? "DESC" : order.direction === "asc" ? "ASC" : "ASC";
      orderParts.push(`${quoteIdentExport(order.column)} ${direction}`);
    }
    text += ` ORDER BY ${orderParts.join(", ")}`;
  }

  const limit = clampLimit(definition.limit);
  let offset = 0;
  if (definition.offset !== undefined) {
    if (!Number.isFinite(definition.offset) || definition.offset < 0) {
      throw new Error("offset must be a non-negative number");
    }
    offset = Math.floor(definition.offset);
  }

  // Fetch one extra row so callers can set has_more without a COUNT query.
  text += ` LIMIT ? OFFSET ?`;
  values.push(limit + 1, offset);

  return { text, values, limit, offset };
}

const AGGREGATE_FNS = new Set(["count", "sum", "avg", "min", "max"]);

export function compileAggregateQuery(definition: AggregateDefinition): {
  text: string;
  values: unknown[];
  limit: number;
  offset: number;
} {
  const table = requireTable(definition.table);
  const columns = getTableColumns(table);
  const known = columnSet(columns);
  known.add("id");

  if (!definition.metrics || definition.metrics.length === 0) {
    throw new Error("aggregate requires at least one metric");
  }

  const selectParts: string[] = [];
  const groupBy = definition.group_by ?? [];
  assertKnownColumns(groupBy, known, "group_by");
  for (const groupColumn of groupBy) {
    selectParts.push(quoteIdentExport(groupColumn));
  }

  for (const metric of definition.metrics) {
    if (!AGGREGATE_FNS.has(metric.fn)) {
      throw new Error(`Unsupported aggregate function "${metric.fn}"`);
    }
    const alias = assertSafeIdentifier(metric.as, "column");
    if (metric.fn === "count" && !metric.column) {
      selectParts.push(`COUNT(*) AS ${quoteIdentExport(alias)}`);
      continue;
    }
    if (!metric.column) {
      throw new Error(`Metric "${metric.fn}" requires a column`);
    }
    assertKnownColumns([metric.column], known, "metric");
    const fn = metric.fn.toUpperCase();
    selectParts.push(
      `${fn}(${quoteIdentExport(metric.column)}) AS ${quoteIdentExport(alias)}`,
    );
  }

  let text = `SELECT ${selectParts.join(", ")} FROM ${quoteIdentExport(table.name)}`;
  const values: unknown[] = [];

  if (definition.filter && Object.keys(definition.filter).length > 0) {
    const filterResult = compileFilter(definition.filter);
    text += ` WHERE ${filterResult.text}`;
    values.push(...filterResult.values);
  }

  if (groupBy.length > 0) {
    text += ` GROUP BY ${groupBy.map((name) => quoteIdentExport(name)).join(", ")}`;
  }

  if (definition.having && Object.keys(definition.having).length > 0) {
    const havingResult = compileFilter(definition.having);
    text += ` HAVING ${havingResult.text}`;
    values.push(...havingResult.values);
  }

  const limit = clampLimit(definition.limit);
  let offset = 0;
  if (definition.offset !== undefined) {
    if (!Number.isFinite(definition.offset) || definition.offset < 0) {
      throw new Error("offset must be a non-negative number");
    }
    offset = Math.floor(definition.offset);
  }

  text += ` LIMIT ? OFFSET ?`;
  values.push(limit + 1, offset);

  return { text, values, limit, offset };
}
