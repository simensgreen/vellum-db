import type { JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../db.ts";
import { asBindings } from "../bindings.ts";
import { pageFromRows } from "../pagination.ts";
import {
  compileAggregateQuery,
  type AggregateDefinition,
  type AggregateMetric,
  type OrderSpec,
  type RefJoinSpec,
} from "./query-compile.ts";
import { requireTable } from "./catalog.ts";
import { isUserTableName, recordStatsDelta } from "./stats-store.ts";

export type { AggregateDefinition, AggregateMetric, OrderSpec, RefJoinSpec };

export function executeAggregateDefinition(definition: AggregateDefinition) {
  const table = requireTable(definition.table);
  const compiled = compileAggregateQuery(definition);
  const fetched = getDatabase()
    .query(compiled.text)
    .all(...asBindings(compiled.values));
  const page = pageFromRows(fetched, compiled.limit, compiled.offset);
  if (isUserTableName(table.name) && page.count > 0) {
    recordStatsDelta({ reads: page.count });
  }
  return {
    table: definition.table,
    count: page.count,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
    rows: page.items,
  };
}

export function buildAggregateDefinition(input: {
  table: string;
  metrics: AggregateMetric[];
  group_by?: string[];
  filter?: JsonFilter;
  having?: JsonFilter;
  order?: OrderSpec[];
  limit?: number;
  offset?: number;
  joins?: RefJoinSpec[];
}): AggregateDefinition {
  return {
    table: input.table,
    metrics: input.metrics,
    group_by: input.group_by,
    filter: input.filter,
    having: input.having,
    order: input.order,
    limit: input.limit,
    offset: input.offset,
    joins: input.joins,
  };
}
