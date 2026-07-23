import { getConfig } from "./db.ts"

export type PageMeta = {
    limit: number
    offset: number
    has_more: boolean
    count: number
}

export function resolvePage(
    limitInput: unknown,
    offsetInput: unknown
): { limit: number; offset: number } {
    const maxRows = getConfig().maxRowsPerQuery
    let limit = maxRows
    if (limitInput !== undefined) {
        if (typeof limitInput !== "number" || !Number.isFinite(limitInput) || limitInput < 1) {
            throw new Error("limit must be a positive number")
        }
        limit = Math.min(Math.floor(limitInput), maxRows)
    }
    let offset = 0
    if (offsetInput !== undefined) {
        if (typeof offsetInput !== "number" || !Number.isFinite(offsetInput) || offsetInput < 0) {
            throw new Error("offset must be a non-negative number")
        }
        offset = Math.floor(offsetInput)
    }
    return { limit, offset }
}

export function pageFromRows<T>(
    rowsWithMaybeExtra: T[],
    limit: number,
    offset: number
): { items: T[] } & PageMeta {
    const has_more = rowsWithMaybeExtra.length > limit
    const items = has_more ? rowsWithMaybeExtra.slice(0, limit) : rowsWithMaybeExtra
    return {
        items,
        count: items.length,
        limit,
        offset,
        has_more
    }
}
