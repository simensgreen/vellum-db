import type { JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../db.ts";
import { asBindings } from "../bindings.ts";
import { pageFromRows } from "../pagination.ts";
import {
  compileAggregateQuery,
  type AggregateDefinition,
  type AggregateMetric,
} from "./query-compile.ts";

export type { AggregateDefinition, AggregateMetric };

export function executeAggregateDefinition(definition: AggregateDefinition) {
  const compiled = compileAggregateQuery(definition);
  const fetched = getDatabase()
    .query(compiled.text)
    .all(...asBindings(compiled.values));
  const page = pageFromRows(fetched, compiled.limit, compiled.offset);
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
  limit?: number;
  offset?: number;
}): AggregateDefinition {
  return {
    table: input.table,
    metrics: input.metrics,
    group_by: input.group_by,
    filter: input.filter,
    having: input.having,
    limit: input.limit,
    offset: input.offset,
  };
}
