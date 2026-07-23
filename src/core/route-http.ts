import { z } from "zod"
import { ApiError, apiErrorResponse } from "../api/errors.ts"
import { zodErrorToApiError } from "../api/format-zod-error.ts"
import { getConfig } from "../db.ts"

export function clampLimit(limit: unknown): number {
    const config = getConfig()
    if (limit === undefined || limit === null) {
        return config.maxRowsPerQuery
    }
    const parsed = Number(limit)
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new ApiError("validation_error", "limit must be a positive integer", {
            hint: "Provide limit as a positive integer"
        })
    }
    return Math.min(Math.floor(parsed), config.maxRowsPerQuery)
}

export function parseOffset(offset: unknown): number {
    if (offset === undefined || offset === null) {
        return 0
    }
    const parsed = Number(offset)
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError("validation_error", "offset must be a non-negative integer", {
            hint: "Provide offset as zero or a positive integer"
        })
    }
    return Math.floor(parsed)
}

export function parseJsonQueryParam(value: string | null, fieldName: string): unknown {
    if (value === null || value === "") {
        return undefined
    }
    try {
        return JSON.parse(value)
    } catch {
        throw new ApiError("invalid_json", `${fieldName} must be valid JSON`, {
            hint: `Provide ${fieldName} as valid JSON text`
        })
    }
}

export function parseRequiredJsonQueryParam(value: string | null, fieldName: string): unknown {
    if (value === null || value === "") {
        throw new ApiError("validation_error", `${fieldName} is required`, {
            hint: `Provide query parameter ${fieldName}`
        })
    }
    return parseJsonQueryParam(value, fieldName)
}

export function requireQueryParam(params: URLSearchParams, name: string): string {
    const value = params.get(name)
    if (value === null || value === "") {
        throw new ApiError("validation_error", `Missing query parameter: ${name}`, {
            hint: `Provide query parameter ${name}`
        })
    }
    return value
}

export function optionalQueryParam(params: URLSearchParams, name: string): string | undefined {
    const value = params.get(name)
    if (value === null || value === "") {
        return undefined
    }
    return value
}

export function optionalScopeParam(params: URLSearchParams): string | null | undefined {
    if (!params.has("scope")) {
        return undefined
    }
    const value = params.get("scope")
    if (value === null || value === "") {
        return null
    }
    return value
}

export async function parseJsonBody(request: Request): Promise<unknown> {
    const text = await request.text()
    if (text.trim() === "") {
        throw new ApiError("invalid_json", "Request body must be JSON", {
            hint: "Send a JSON object in the request body"
        })
    }
    try {
        return JSON.parse(text)
    } catch {
        throw new ApiError("invalid_json", "Request body must be valid JSON", {
            hint: "Fix JSON syntax in the request body"
        })
    }
}

export function routeErrorBody(
    body: {
        type: string
        msg?: string
        hint?: string
    },
    status = 400
): Response {
    return Response.json(body, { status })
}

export function routeOk(data: unknown, status = 200): Response {
    return Response.json(data, { status })
}

export async function handleRoute<T>(handler: () => T | Promise<T>): Promise<Response> {
    try {
        const result = await handler()
        return routeOk(result)
    } catch (error) {
        if (error instanceof ApiError) {
            return apiErrorResponse(error)
        }
        if (error instanceof z.ZodError) {
            const body = zodErrorToApiError(error)
            return routeErrorBody(body, 400)
        }
        if (error instanceof Error && error.message.includes("disabled")) {
            return routeErrorBody({ type: "forbidden", msg: error.message }, 403)
        }
        return routeErrorBody({ type: "internal_error", msg: "Internal server error" }, 500)
    }
}
