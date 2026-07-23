import type { JsonFilter } from "@truto/sqlite-builder"
import { getTableColumns, parseTableDefinition, requireTable, type TableRow } from "./catalog.ts"
import { primaryKeySlugs } from "./table/types.ts"

function rowIdColumnSlug(table: TableRow): string {
    const columns = getTableColumns(table)
    if (columns.some((column) => column.slug === "id")) {
        return "id"
    }
    const primaryKeys = primaryKeySlugs(parseTableDefinition(table))
    if (primaryKeys.length === 1) {
        const primaryKeySlug = primaryKeys[0]
        if (primaryKeySlug !== undefined) {
            return primaryKeySlug
        }
    }
    return "id"
}

export function resolveRowIdFilter(tableName: string, filter: JsonFilter): JsonFilter {
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
        return filter
    }
    if (!Object.hasOwn(filter, "id")) {
        return filter
    }

    const table = requireTable(tableName)
    const idColumn = rowIdColumnSlug(table)
    if (idColumn === "id") {
        return filter
    }

    const record = filter as Record<string, unknown>
    const { id, ...rest } = record
    return { ...rest, [idColumn]: id } as JsonFilter
}

export function rowIdInFilter(tableName: string, ids: string[]): JsonFilter {
    const table = requireTable(tableName)
    const idColumn = rowIdColumnSlug(table)
    return { [idColumn]: { in: ids } } as JsonFilter
}
