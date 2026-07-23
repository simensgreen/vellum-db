import type { JsonFilter } from "@truto/sqlite-builder"
import { asBindings } from "../bindings.ts"
import { getDatabase } from "../db.ts"
import { pageFromRows } from "../pagination.ts"
import { requireTable } from "./catalog.ts"
import {
    type AggregateDefinition,
    type AggregateMetric,
    compileAggregateCountQuery,
    compileAggregateQuery,
    type OrderSpec,
    type RefJoinSpec
} from "./query-compile.ts"
import { isUserTableName, recordStatsDelta } from "./stats-store.ts"

export type { AggregateDefinition, AggregateMetric, OrderSpec, RefJoinSpec }

export function executeAggregateDefinition(definition: AggregateDefinition) {
    const table = requireTable(definition.table)
    const compiled = compileAggregateQuery(definition)
    const fetched = getDatabase()
        .query(compiled.text)
        .all(...asBindings(compiled.values))
    const countCompiled = compileAggregateCountQuery(definition)
    const totalRow = getDatabase()
        .query(countCompiled.text)
        .get(...asBindings(countCompiled.values)) as { total: number }
    const page = pageFromRows(fetched, compiled.limit, compiled.offset, totalRow.total)
    if (isUserTableName(table.name) && page.page_count > 0) {
        recordStatsDelta({ reads: page.page_count })
    }
    return {
        table: definition.table,
        page_count: page.page_count,
        total_count: page.total_count,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more,
        rows: page.items
    }
}

export function buildAggregateDefinition(input: {
    table: string
    metrics: AggregateMetric[]
    group_by?: string[]
    filter?: JsonFilter
    having?: JsonFilter
    order?: OrderSpec[]
    limit?: number
    offset?: number
    joins?: RefJoinSpec[]
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
        joins: input.joins
    }
}
