import { compileFilter, sql, type JsonFilter } from "@truto/sqlite-builder";
import { getConfig } from "../db.ts";
import {
  getCompiledColumns,
  getTableColumns,
  parseTableDefinition,
  quoteIdentExport,
  requireTable,
  type ColumnSpec,
  type TableRow,
} from "./catalog.ts";
import { assertSafeIdentifier } from "../identifiers.ts";
import { primaryKeySlugs } from "./table/types.ts";

export type OrderSpec = {
  column: string;
  direction?: "asc" | "desc";
};

export type JoinType = "left" | "inner" | "right";

export type RefJoinSpec = {
  ref: string;
  source?: string;
  type?: JoinType;
  select: Record<string, string>;
};

export type JoinOutputMeta = {
  outputColumn: string;
  sourceColumn: string;
  joinTableName: string;
};

export type QueryDefinition = {
  table: string;
  filter?: JsonFilter;
  order?: OrderSpec[];
  limit?: number;
  offset?: number;
  columns?: string[];
  joins?: RefJoinSpec[];
};

type JoinClause = {
  joinType: JoinType;
  sourceAlias: string;
  alias: string;
  table: string;
  refColumn: string;
  targetColumn: string;
};

type ResolvedJoinGraph = {
  baseTableName: string;
  baseColumns: ColumnSpec[];
  known: Set<string>;
  outputSql: Map<string, string>;
  defaultSelectColumns: string[];
  joinClauses: JoinClause[];
  joinOutputs: JoinOutputMeta[];
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
  order?: OrderSpec[];
  limit?: number;
  offset?: number;
  joins?: RefJoinSpec[];
};

const AGGREGATE_FNS = new Set(["count", "sum", "avg", "min", "max"]);

function columnSet(columns: ColumnSpec[]): Set<string> {
  return new Set(columns.map((column) => column.name));
}

function normalizeJoinType(type: JoinType | undefined): JoinType {
  return type ?? "left";
}

function joinTypeKeyword(type: JoinType): string {
  switch (type) {
    case "inner":
      return "INNER JOIN";
    case "right":
      return "RIGHT JOIN";
    default:
      return "LEFT JOIN";
  }
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

function assertBaseMetricColumns(
  names: string[],
  baseKnown: Set<string>,
  label: string,
): void {
  for (const name of names) {
    assertSafeIdentifier(name, "column");
    if (!baseKnown.has(name)) {
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

function qualifyColumnExpression(
  columnName: string,
  outputSql: Map<string, string>,
): string {
  const expression = outputSql.get(columnName);
  if (!expression) {
    throw new Error(`Unknown column "${columnName}"`);
  }
  return expression;
}

function qualifyFilterText(
  filterText: string,
  outputSql: Map<string, string>,
): string {
  let text = filterText;
  const replacements = [...outputSql.entries()].sort(
    (left, right) => right[0].length - left[0].length,
  );
  for (const [logical, sqlExpr] of replacements) {
    text = text.replaceAll(quoteIdentExport(logical), sqlExpr);
  }
  return text;
}

function seedBaseOutputSql(
  baseTable: TableRow,
): {
  baseTableName: string;
  baseColumns: ColumnSpec[];
  baseKnown: Set<string>;
  known: Set<string>;
  outputSql: Map<string, string>;
  defaultSelectColumns: string[];
} {
  const baseTableName = baseTable.name;
  const baseDefinition = parseTableDefinition(baseTable);
  const baseCompiled = getCompiledColumns(baseTable);
  const baseColumns = getTableColumns(baseTable);
  const baseKnown = columnSet(baseColumns);
  baseKnown.add("id");

  const known = new Set(baseKnown);
  const outputSql = new Map<string, string>();
  const defaultSelectColumns = ["id", ...baseColumns.map((column) => column.name)];
  const basePrefix = quoteIdentExport(baseTableName);

  for (const column of baseCompiled) {
    outputSql.set(
      column.slug,
      `${basePrefix}.${quoteIdentExport(column.slug)}`,
    );
  }

  const primaryKeys = primaryKeySlugs(baseDefinition);
  if (primaryKeys.length === 1) {
    outputSql.set(
      "id",
      `${basePrefix}.${quoteIdentExport(primaryKeys[0]!)}`,
    );
  } else {
    outputSql.set("id", `${basePrefix}.${quoteIdentExport("id")}`);
  }

  return {
    baseTableName,
    baseColumns,
    baseKnown,
    known,
    outputSql,
    defaultSelectColumns,
  };
}

export function resolveJoinGraph(
  baseTable: TableRow,
  joins: RefJoinSpec[],
): ResolvedJoinGraph {
  const seeded = seedBaseOutputSql(baseTable);
  const tableAliases = new Map<string, string>([
    [seeded.baseTableName, quoteIdentExport(seeded.baseTableName)],
  ]);

  const joinClauses: JoinClause[] = [];
  const joinOutputs: JoinOutputMeta[] = [];

  joins.forEach((joinSpec, joinIndex) => {
    const refSlug = assertSafeIdentifier(joinSpec.ref, "column");
    const sourceTableName =
      joinIndex === 0 && joinSpec.source === undefined
        ? seeded.baseTableName
        : joinSpec.source ?? seeded.baseTableName;

    if (!tableAliases.has(sourceTableName)) {
      throw new Error(`Unknown join source table "${sourceTableName}"`);
    }

    const sourceTable = requireTable(sourceTableName);
    const sourceDefinition = parseTableDefinition(sourceTable);
    const refColumn = sourceDefinition.columns.find(
      (column) => column.slug === refSlug,
    );
    if (!refColumn) {
      throw new Error(
        `Unknown join ref column "${joinSpec.ref}" on table "${sourceTableName}"`,
      );
    }
    if (refColumn.data.type !== "ref") {
      throw new Error(
        `Column "${joinSpec.ref}" on table "${sourceTableName}" is not a ref column`,
      );
    }

    const joinTable = requireTable(refColumn.data.table);
    const joinCompiled = getCompiledColumns(joinTable);
    const joinAlias = `_j${joinIndex}`;
    const joinPrefix = quoteIdentExport(joinAlias);
    const sourceAlias = tableAliases.get(sourceTableName)!;

    joinClauses.push({
      joinType: normalizeJoinType(joinSpec.type),
      sourceAlias,
      alias: joinAlias,
      table: joinTable.name,
      refColumn: refSlug,
      targetColumn: refColumn.data.column,
    });

    tableAliases.set(joinTable.name, joinPrefix);

    for (const [sourceColumn, outputColumn] of Object.entries(joinSpec.select)) {
      const sourceColumnSlug = assertSafeIdentifier(sourceColumn, "column");
      const outputSlug = assertSafeIdentifier(outputColumn, "column");
      if (!joinCompiled.some((column) => column.slug === sourceColumnSlug)) {
        throw new Error(
          `Unknown join select column "${sourceColumn}" on table "${joinTable.name}"`,
        );
      }
      if (seeded.known.has(outputSlug)) {
        throw new Error(`Duplicate output column "${outputColumn}"`);
      }
      seeded.known.add(outputSlug);
      seeded.defaultSelectColumns.push(outputSlug);
      seeded.outputSql.set(
        outputSlug,
        `${joinPrefix}.${quoteIdentExport(sourceColumnSlug)}`,
      );
      joinOutputs.push({
        outputColumn: outputSlug,
        sourceColumn: sourceColumnSlug,
        joinTableName: joinTable.name,
      });
    }
  });

  return {
    baseTableName: seeded.baseTableName,
    baseColumns: seeded.baseColumns,
    known: seeded.known,
    outputSql: seeded.outputSql,
    defaultSelectColumns: seeded.defaultSelectColumns,
    joinClauses,
    joinOutputs,
  };
}

function compileFromClause(resolved: ResolvedJoinGraph): string {
  let text = ` FROM ${quoteIdentExport(resolved.baseTableName)}`;
  for (const join of resolved.joinClauses) {
    text += ` ${joinTypeKeyword(join.joinType)} ${quoteIdentExport(join.table)} AS ${quoteIdentExport(join.alias)} ON ${join.sourceAlias}.${quoteIdentExport(join.refColumn)} = ${quoteIdentExport(join.alias)}.${quoteIdentExport(join.targetColumn)}`;
  }
  return text;
}

function appendFilterClause(
  text: string,
  values: unknown[],
  filter: JsonFilter | undefined,
  outputSql: Map<string, string>,
  useQualifiedColumns: boolean,
): string {
  if (!filter || Object.keys(filter).length === 0) {
    return text;
  }
  const filterResult = compileFilter(filter);
  const whereText = useQualifiedColumns
    ? qualifyFilterText(filterResult.text, outputSql)
    : filterResult.text;
  values.push(...filterResult.values);
  return `${text} WHERE ${whereText}`;
}

function appendOrderClause(
  text: string,
  order: OrderSpec[] | undefined,
  known: Set<string>,
  outputSql: Map<string, string>,
  useQualifiedColumns: boolean,
): string {
  if (!order || order.length === 0) {
    return text;
  }
  const orderParts: string[] = [];
  for (const orderSpec of order) {
    assertKnownColumns([orderSpec.column], known, "order");
    const direction =
      orderSpec.direction === "desc"
        ? "DESC"
        : orderSpec.direction === "asc"
          ? "ASC"
          : "ASC";
    const expression = useQualifiedColumns
      ? qualifyColumnExpression(orderSpec.column, outputSql)
      : quoteIdentExport(orderSpec.column);
    orderParts.push(`${expression} ${direction}`);
  }
  return `${text} ORDER BY ${orderParts.join(", ")}`;
}

function appendPaginationClause(
  text: string,
  values: unknown[],
  limit: number | undefined,
  offset: number | undefined,
): { text: string; values: unknown[]; limit: number; offset: number } {
  const resolvedLimit = clampLimit(limit);
  let resolvedOffset = 0;
  if (offset !== undefined) {
    if (!Number.isFinite(offset) || offset < 0) {
      throw new Error("offset must be a non-negative number");
    }
    resolvedOffset = Math.floor(offset);
  }
  values.push(resolvedLimit + 1, resolvedOffset);
  return {
    text: `${text} LIMIT ? OFFSET ?`,
    values,
    limit: resolvedLimit,
    offset: resolvedOffset,
  };
}

export function resolveQueryJoinOutputs(
  tableName: string,
  joins: RefJoinSpec[] | undefined,
): JoinOutputMeta[] {
  if (!joins || joins.length === 0) {
    return [];
  }
  const table = requireTable(tableName);
  return resolveJoinGraph(table, joins).joinOutputs;
}

export function compileSelectQuery(definition: QueryDefinition): {
  text: string;
  values: unknown[];
  limit: number;
  offset: number;
} {
  const table = requireTable(definition.table);
  const joins = definition.joins ?? [];

  if (joins.length === 0) {
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

    text = appendFilterClause(text, values, definition.filter, new Map(), false);
    text = appendOrderClause(text, definition.order, known, new Map(), false);

    const paginated = appendPaginationClause(
      text,
      values,
      definition.limit,
      definition.offset,
    );
    return {
      text: paginated.text,
      values: paginated.values,
      limit: paginated.limit,
      offset: paginated.offset,
    };
  }

  const resolved = resolveJoinGraph(table, joins);
  const selectColumns =
    definition.columns && definition.columns.length > 0
      ? definition.columns
      : resolved.defaultSelectColumns;
  assertKnownColumns(selectColumns, resolved.known, "select");

  const selectParts = selectColumns.map(
    (columnName) =>
      `${qualifyColumnExpression(columnName, resolved.outputSql)} AS ${quoteIdentExport(columnName)}`,
  );

  const values: unknown[] = [];
  let text = `SELECT ${selectParts.join(", ")}${compileFromClause(resolved)}`;
  text = appendFilterClause(text, values, definition.filter, resolved.outputSql, true);
  text = appendOrderClause(
    text,
    definition.order,
    resolved.known,
    resolved.outputSql,
    true,
  );

  const paginated = appendPaginationClause(
    text,
    values,
    definition.limit,
    definition.offset,
  );
  return {
    text: paginated.text,
    values: paginated.values,
    limit: paginated.limit,
    offset: paginated.offset,
  };
}

export function compileCountQuery(
  definition: Pick<QueryDefinition, "table" | "filter" | "joins">,
): {
  text: string;
  values: unknown[];
} {
  const table = requireTable(definition.table);
  const joins = definition.joins ?? [];
  const values: unknown[] = [];

  if (joins.length === 0) {
    const fromIdent = sql.ident(table.name);
    let query = sql`SELECT COUNT(*) AS total FROM ${fromIdent}`;
    values.push(...query.values);
    let text = query.text;
    text = appendFilterClause(text, values, definition.filter, new Map(), false);
    return { text, values };
  }

  const resolved = resolveJoinGraph(table, joins);
  let text = `SELECT COUNT(*) AS total${compileFromClause(resolved)}`;
  text = appendFilterClause(text, values, definition.filter, resolved.outputSql, true);
  return { text, values };
}

export function compileAggregateQuery(definition: AggregateDefinition): {
  text: string;
  values: unknown[];
  limit: number;
  offset: number;
} {
  const table = requireTable(definition.table);
  const joins = definition.joins ?? [];
  const seeded = seedBaseOutputSql(table);
  const resolved =
    joins.length > 0 ? resolveJoinGraph(table, joins) : null;
  const known = resolved?.known ?? seeded.known;
  const outputSql = resolved?.outputSql ?? seeded.outputSql;
  const useQualifiedColumns = joins.length > 0;

  if (!definition.metrics || definition.metrics.length === 0) {
    throw new Error("aggregate requires at least one metric");
  }

  const selectParts: string[] = [];
  const groupBy = definition.group_by ?? [];
  assertKnownColumns(groupBy, known, "group_by");
  for (const groupColumn of groupBy) {
    const expression = useQualifiedColumns
      ? qualifyColumnExpression(groupColumn, outputSql)
      : quoteIdentExport(groupColumn);
    selectParts.push(`${expression} AS ${quoteIdentExport(groupColumn)}`);
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
    assertBaseMetricColumns([metric.column], seeded.baseKnown, "metric");
    const fn = metric.fn.toUpperCase();
    const metricColumn = `${quoteIdentExport(seeded.baseTableName)}.${quoteIdentExport(metric.column)}`;
    selectParts.push(
      `${fn}(${metricColumn}) AS ${quoteIdentExport(alias)}`,
    );
  }

  const values: unknown[] = [];
  let text = `SELECT ${selectParts.join(", ")}`;
  text += resolved
    ? compileFromClause(resolved)
    : ` FROM ${quoteIdentExport(seeded.baseTableName)}`;

  text = appendFilterClause(text, values, definition.filter, outputSql, useQualifiedColumns);

  if (groupBy.length > 0) {
    const groupExpressions = groupBy.map((name) =>
      useQualifiedColumns
        ? qualifyColumnExpression(name, outputSql)
        : quoteIdentExport(name),
    );
    text += ` GROUP BY ${groupExpressions.join(", ")}`;
  }

  if (definition.having && Object.keys(definition.having).length > 0) {
    const havingResult = compileFilter(definition.having);
    text += ` HAVING ${havingResult.text}`;
    values.push(...havingResult.values);
  }

  if (definition.order && definition.order.length > 0) {
    const metricAliases = new Set(
      definition.metrics.map((metric) => assertSafeIdentifier(metric.as, "column")),
    );
    const orderParts: string[] = [];
    for (const orderSpec of definition.order) {
      assertSafeIdentifier(orderSpec.column, "column");
      let expression: string;
      if (useQualifiedColumns && outputSql.has(orderSpec.column)) {
        expression = qualifyColumnExpression(orderSpec.column, outputSql);
      } else if (metricAliases.has(orderSpec.column)) {
        expression = quoteIdentExport(orderSpec.column);
      } else if (known.has(orderSpec.column)) {
        expression = quoteIdentExport(orderSpec.column);
      } else {
        throw new Error(`Unknown order column "${orderSpec.column}"`);
      }
      const direction =
        orderSpec.direction === "desc"
          ? "DESC"
          : orderSpec.direction === "asc"
            ? "ASC"
            : "ASC";
      orderParts.push(`${expression} ${direction}`);
    }
    text += ` ORDER BY ${orderParts.join(", ")}`;
  }

  const paginated = appendPaginationClause(
    text,
    values,
    definition.limit,
    definition.offset,
  );
  return {
    text: paginated.text,
    values: paginated.values,
    limit: paginated.limit,
    offset: paginated.offset,
  };
}
