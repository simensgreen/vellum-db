import type { JsonFilter } from "@truto/sqlite-builder"
import { asBindings } from "../bindings.ts"
import { getDatabase } from "../db.ts"
import { pageFromRows } from "../pagination.ts"
import type { JsonSchemaObject } from "../schema-validate.ts"
import { coerceCellValue, decodeRow, getTableColumns, requireTable } from "./catalog.ts"
import {
    compileCountQuery,
    compileSelectQuery,
    type OrderSpec,
    type QueryDefinition,
    type RefJoinSpec,
    resolveQueryJoinOutputs
} from "./query-compile.ts"
import { isUserTableName, recordStatsDelta } from "./stats-store.ts"

export type { OrderSpec, QueryDefinition, RefJoinSpec }

function decodeQueryRow(
    row: Record<string, unknown>,
    baseColumns: ReturnType<typeof getTableColumns>,
    baseSchema: JsonSchemaObject,
    joinOutputs: ReturnType<typeof resolveQueryJoinOutputs>
): Record<string, unknown> {
    const baseValues = Object.fromEntries(
        baseColumns.map((column) => [column.name, row[column.name]])
    )
    const decoded = decodeRow(baseValues, baseColumns, baseSchema)

    for (const joinOutput of joinOutputs) {
        const raw = row[joinOutput.outputColumn]
        if (raw === null || raw === undefined) {
            decoded[joinOutput.outputColumn] = null
            continue
        }
        const joinTable = requireTable(joinOutput.joinTableName)
        const joinColumns = getTableColumns(joinTable)
        const joinSchema = JSON.parse(joinTable.schema_json) as JsonSchemaObject
        const joinColumn = joinColumns.find((column) => column.name === joinOutput.sourceColumn)
        if (!joinColumn) {
            decoded[joinOutput.outputColumn] = raw
            continue
        }
        try {
            decoded[joinOutput.outputColumn] = coerceCellValue(raw, joinColumn, joinSchema)
        } catch {
            decoded[joinOutput.outputColumn] = raw
        }
    }

    return decoded
}

export function executeQueryDefinition(definition: QueryDefinition) {
    const table = requireTable(definition.table)
    const columns = getTableColumns(table)
    const rowSchema = JSON.parse(table.schema_json) as JsonSchemaObject
    const joinOutputs = resolveQueryJoinOutputs(definition.table, definition.joins)
    const compiled = compileSelectQuery(definition)
    const fetched = getDatabase()
        .query(compiled.text)
        .all(...asBindings(compiled.values)) as Record<string, unknown>[]
    const page = pageFromRows(fetched, compiled.limit, compiled.offset)
    const countCompiled = compileCountQuery(definition)
    const totalRow = getDatabase()
        .query(countCompiled.text)
        .get(...asBindings(countCompiled.values)) as { total: number }
    if (isUserTableName(table.name) && page.count > 0) {
        recordStatsDelta({ reads: page.count })
    }
    return {
        table: table.name,
        count: page.count,
        total_count: totalRow.total,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more,
        rows: page.items.map((row) =>
            joinOutputs.length === 0
                ? decodeRow(row, columns, rowSchema)
                : decodeQueryRow(row, columns, rowSchema, joinOutputs)
        )
    }
}

export function buildQueryDefinition(input: {
    table: string
    filter?: JsonFilter
    order?: OrderSpec[]
    limit?: number
    offset?: number
    columns?: string[]
    joins?: RefJoinSpec[]
}): QueryDefinition {
    return {
        table: input.table,
        filter: input.filter,
        order: input.order,
        limit: input.limit,
        offset: input.offset,
        columns: input.columns,
        joins: input.joins
    }
}
