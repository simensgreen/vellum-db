import { getTableColumns, listTables, parseTableDefinition } from "./catalog.ts"

export function listTablesView(input: {
    scope?: string | null
    slug_prefix?: string
    limit?: number
    offset?: number
}) {
    const page = listTables({
        scope: input.scope,
        slug_prefix: input.slug_prefix,
        limit: input.limit,
        offset: input.offset
    })
    return {
        tables: page.tables.map((table) => ({
            slug: table.name,
            scope: table.scope,
            definition: parseTableDefinition(table),
            columns: getTableColumns(table),
            created_at: table.created_at,
            updated_at: table.updated_at
        })),
        page_count: page.page_count,
        total_count: page.total_count,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more
    }
}
