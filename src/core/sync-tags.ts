/** Static invalidation tags — fixed strings only. */
export const SYNC_TAGS = {
    tables: "vellum-db:tables",
    views: "vellum-db:views"
} as const

export type StaticSyncTag = (typeof SYNC_TAGS)[keyof typeof SYNC_TAGS]

const TABLE_DATA_PREFIX = "vellum-db:table:" as const

export function tableDataTag(tableName: string): string {
    return `${TABLE_DATA_PREFIX}${tableName}`
}

export function tableNameFromDataTag(tag: string): string | null {
    return tag.startsWith(TABLE_DATA_PREFIX) ? tag.slice(TABLE_DATA_PREFIX.length) : null
}

/** Tag batches for publish (core) */
export function invalidationTagsForCatalogChange(tableName?: string): readonly string[] {
    return tableName ? [SYNC_TAGS.tables, tableDataTag(tableName)] : [SYNC_TAGS.tables]
}

export function invalidationTagsForRowMutation(tableName: string): readonly string[] {
    return [tableDataTag(tableName)]
}

export function invalidationTagsForViewsChange(): readonly string[] {
    return [SYNC_TAGS.views]
}

export function subscribeTagsForViewList(): readonly string[] {
    return [SYNC_TAGS.views]
}

export function invalidationTagsForRawSqlMutation(): readonly string[] {
    return [SYNC_TAGS.tables]
}

/** Tag batches for subscribe (app) */
export function subscribeTagsForTableList(): readonly string[] {
    return [SYNC_TAGS.tables]
}

export function subscribeTagsForRowView(tableName: string): readonly string[] {
    return [SYNC_TAGS.tables, tableDataTag(tableName)]
}
