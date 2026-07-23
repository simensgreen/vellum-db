import type { Scope } from "../api/schemas/common.ts"
import {
    alterUserTable,
    createUserTable,
    dropUserTable,
    getTableColumns,
    parseTableDefinition
} from "./catalog.ts"
import { notifyInvalidation } from "./sync.ts"
import { invalidationTagsForCatalogChange } from "./sync-tags.ts"
import type { TableDefinition } from "./table/types.ts"

export function createTable(input: { definition: TableDefinition; scope: Scope }) {
    const table = createUserTable(input.definition, {
        scope: input.scope
    })
    notifyInvalidation(invalidationTagsForCatalogChange(table.name))
    const definition = parseTableDefinition(table)
    return {
        slug: table.name,
        scope: table.scope,
        definition,
        columns: getTableColumns(table),
        created_at: table.created_at
    }
}

export function alterTable(input: {
    table: string
    add?: Array<{
        name: string
        slug: string
        column: TableDefinition["columns"][number]
    }>
    drop?: string[]
    scope?: string | null
}) {
    const table = alterUserTable({
        table: input.table,
        add: input.add,
        drop: input.drop,
        ...(Object.hasOwn(input, "scope") ? { scope: input.scope } : {})
    })
    notifyInvalidation(invalidationTagsForCatalogChange(table.name))
    return {
        slug: table.name,
        scope: table.scope,
        definition: parseTableDefinition(table),
        columns: getTableColumns(table),
        updated_at: table.updated_at
    }
}

export function dropTable(input: { table: string }) {
    const result = dropUserTable(input.table)
    notifyInvalidation(invalidationTagsForCatalogChange(result.slug))
    return result
}
