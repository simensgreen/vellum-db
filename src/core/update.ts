import { compileFilter, type JsonFilter } from "@truto/sqlite-builder"
import { asBindings } from "../bindings.ts"
import { getDatabase } from "../db.ts"
import { type JsonSchemaObject, validateRowAgainstSchema } from "../schema-validate.ts"
import {
    decodeRow,
    encodeCellValue,
    getTableColumns,
    parseTableDefinition,
    quoteIdentExport,
    requireTable
} from "./catalog.ts"
import { resolveRowIdFilter } from "./row-id-filter.ts"
import { isUserTableName, recordStatsDelta } from "./stats-store.ts"
import { notifyInvalidation } from "./sync.ts"
import { invalidationTagsForRowMutation } from "./sync-tags.ts"
import { primaryKeySlugs } from "./table/types.ts"

export function updateRows(input: {
    table: string
    filter: JsonFilter
    patch: Record<string, unknown>
    sideEffects?: boolean
}) {
    const sideEffects = input.sideEffects ?? true
    const table = requireTable(input.table)
    const filter = resolveRowIdFilter(input.table, input.filter)
    if (!filter || Object.keys(filter).length === 0) {
        throw new Error("filter must be a non-empty object")
    }
    const patch = input.patch
    const columns = getTableColumns(table)
    const rowSchema = JSON.parse(table.schema_json) as JsonSchemaObject
    const columnByName = new Map(columns.map((column) => [column.name, column]))
    for (const key of Object.keys(patch)) {
        if (!columnByName.has(key)) {
            throw new Error(`Unknown column "${key}" in patch`)
        }
    }

    const filterResult = compileFilter(filter)
    const selectSql = `SELECT * FROM ${quoteIdentExport(table.name)} WHERE ${filterResult.text}`
    const matched = getDatabase()
        .query(selectSql)
        .all(...asBindings(filterResult.values)) as Record<string, unknown>[]

    let changes = 0
    for (const existing of matched) {
        const merged = decodeRow(existing, columns, rowSchema)
        Object.assign(merged, patch)
        validateRowAgainstSchema(table.name, table.schema_json, merged)

        const setColumns = Object.keys(patch)
        const setSql = setColumns.map((name) => `${quoteIdentExport(name)} = ?`).join(", ")
        const setValues = setColumns.map((name) =>
            encodeCellValue(patch[name], columnByName.get(name)!)
        )
        const definition = parseTableDefinition(table)
        const primaryKeySlugsList = primaryKeySlugs(definition)
        const whereClause = primaryKeySlugsList
            .map((slug) => `${quoteIdentExport(slug)} = ?`)
            .join(" AND ")
        const whereValues = primaryKeySlugsList.map((slug) => existing[slug])
        const updateSql = `UPDATE ${quoteIdentExport(table.name)} SET ${setSql} WHERE ${whereClause}`
        const result = getDatabase()
            .query(updateSql)
            .run(...asBindings([...setValues, ...whereValues]))
        changes += result.changes
    }

    if (sideEffects && changes > 0) {
        notifyInvalidation(invalidationTagsForRowMutation(table.name))
        if (isUserTableName(table.name)) {
            recordStatsDelta({ updates: changes })
        }
    }

    return { table: table.name, matched: matched.length, changes }
}
