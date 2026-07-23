import { assertTableDefinition } from "vellum-db/core/table/index"
import type { TableDefinition } from "vellum-db/core/table/types"

export function parseTableDefinitionText(text: string): {
    definition: TableDefinition | null
    error: string | null
} {
    try {
        const parsed: unknown = JSON.parse(text)
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { definition: null, error: "TableDefinition must be a JSON object" }
        }
        const definition = assertTableDefinition(parsed)
        return { definition, error: null }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { definition: null, error: message }
    }
}

export const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/

export function validateSlug(slug: string): string | null {
    const trimmed = slug.trim()
    if (!trimmed) {
        return "Table slug is required"
    }
    if (!SLUG_PATTERN.test(trimmed)) {
        return "Slug must match [a-z][a-z0-9_]*"
    }
    return null
}

export const SCOPE_PATTERN = /^[a-z][a-z0-9_]*$/

export function validateScope(scope: string): string | null {
    const trimmed = scope.trim()
    if (!trimmed) {
        return "Scope is required"
    }
    if (!SCOPE_PATTERN.test(trimmed)) {
        return "Scope must match [a-z][a-z0-9_]*"
    }
    return null
}
