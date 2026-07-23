import type { TableRow } from "../../src/core/catalog.ts"

export function tableBySlug(tables: TableRow[], slug: string): TableRow {
    const table = tables.find((entry) => entry.name === slug)
    if (!table) {
        throw new Error(`Table "${slug}" not found`)
    }
    return table
}
