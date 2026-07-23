import type { ZodType } from "zod"
import { clampLimit, parseOffset } from "../core/route-http.ts"
import { z } from "./zod.ts"

export function searchParamsRecord(params: URLSearchParams): Record<string, string | undefined> {
    const record: Record<string, string | undefined> = {}
    for (const key of params.keys()) {
        const value = params.get(key)
        record[key] = value === null || value === "" ? undefined : value
    }
    return record
}

export function parseScopeFromParams(params: URLSearchParams): string | null | undefined {
    if (!params.has("scope")) {
        return undefined
    }
    const value = params.get("scope")
    if (value === null || value === "") {
        return null
    }
    return value
}

export function applyPaginationFromParams(
    params: URLSearchParams,
    parsed: { limit?: number; offset?: number }
): { limit?: number; offset?: number } {
    return {
        limit: params.has("limit") ? clampLimit(parsed.limit) : undefined,
        offset: params.has("offset") ? parseOffset(parsed.offset) : undefined
    }
}

export function parseRouteQuery<
    TSchema extends ZodType,
    TOptions extends {
        pagination?: boolean
        scope?: boolean
    } = {}
>(
    request: Request,
    schema: TSchema,
    options: TOptions = {} as TOptions
): z.infer<TSchema> &
    (TOptions["pagination"] extends true ? { limit?: number; offset?: number } : {}) &
    (TOptions["scope"] extends true ? { scope?: string | null } : {}) {
    const params = new URL(request.url).searchParams
    const parsed = schema.parse(searchParamsRecord(params)) as z.infer<TSchema> & {
        limit?: number
        offset?: number
        scope?: string | null
    }

    let result: Record<string, unknown> = { ...parsed }

    if (options.pagination) {
        result = {
            ...result,
            ...applyPaginationFromParams(params, parsed)
        }
    }

    if (options.scope) {
        const scopeFromParams = parseScopeFromParams(params)
        if (scopeFromParams !== undefined) {
            result.scope = scopeFromParams
        } else {
            delete result.scope
        }
    }

    return result as z.infer<TSchema> &
        (TOptions["pagination"] extends true ? { limit?: number; offset?: number } : {}) &
        (TOptions["scope"] extends true ? { scope?: string | null } : {})
}

export async function parseRouteBody<TSchema extends ZodType>(
    request: Request,
    schema: TSchema
): Promise<z.infer<TSchema>> {
    const text = await request.text()
    if (text.trim() === "") {
        throw new Error("Request body must be JSON")
    }
    let json: unknown
    try {
        json = JSON.parse(text)
    } catch {
        throw new Error("Request body must be valid JSON")
    }
    return schema.parse(json)
}

export async function parseRouteRequest<TQuerySchema extends ZodType, TBodySchema extends ZodType>(
    request: Request,
    parts: {
        query: TQuerySchema
        body: TBodySchema
        pagination?: boolean
        scope?: boolean
    }
): Promise<{
    query: z.infer<TQuerySchema>
    body: z.infer<TBodySchema>
}> {
    return {
        query: parseRouteQuery(request, parts.query, {
            pagination: parts.pagination,
            scope: parts.scope
        }),
        body: await parseRouteBody(request, parts.body)
    }
}

export { z }
