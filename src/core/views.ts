import type { SQLQueryBindings } from "bun:sqlite"
import { asBindings } from "../bindings.ts"
import { getDatabase } from "../db.ts"
import { assertSafeIdentifier } from "../identifiers.ts"
import { pageFromRows, resolvePage } from "../pagination.ts"
import { validateAgainstSchema } from "../schema-validate.ts"
import { normalizeScope, requireScope } from "./catalog.ts"
import type { AggregateDefinition, QueryDefinition } from "./query-compile.ts"

export type ViewKind = "query" | "aggregate"

export type ViewRow = {
    slug: string
    name: string
    kind: ViewKind
    definition_json: string
    description: string | null
    scope: string | null
    created_at: string
    updated_at: string
}

const VIEW_ROW_SELECT =
    "SELECT slug, name, kind, definition_json, description, scope, created_at, updated_at FROM _views"

const refJoinDefinitionSchema = {
    type: "object",
    properties: {
        ref: { type: "string" },
        source: { type: "string" },
        type: { type: "string", enum: ["left", "inner", "right"] },
        select: {
            type: "object",
            additionalProperties: { type: "string" }
        }
    },
    required: ["ref", "select"],
    additionalProperties: false
} as const

const queryDefinitionSchema = {
    type: "object",
    properties: {
        table: { type: "string" },
        filter: { type: "object" },
        order: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    column: { type: "string" },
                    direction: { type: "string", enum: ["asc", "desc"] }
                },
                required: ["column"],
                additionalProperties: false
            }
        },
        limit: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 },
        columns: { type: "array", items: { type: "string" } },
        joins: {
            type: "array",
            items: refJoinDefinitionSchema
        }
    },
    required: ["table"],
    additionalProperties: false
} as const

const aggregateDefinitionSchema = {
    type: "object",
    properties: {
        table: { type: "string" },
        metrics: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                properties: {
                    fn: {
                        type: "string",
                        enum: ["count", "sum", "avg", "min", "max"]
                    },
                    column: { type: "string" },
                    as: { type: "string" }
                },
                required: ["fn", "as"],
                additionalProperties: false
            }
        },
        group_by: { type: "array", items: { type: "string" } },
        filter: { type: "object" },
        having: { type: "object" },
        order: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    column: { type: "string" },
                    direction: { type: "string", enum: ["asc", "desc"] }
                },
                required: ["column"],
                additionalProperties: false
            }
        },
        limit: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 },
        joins: {
            type: "array",
            items: refJoinDefinitionSchema
        }
    },
    required: ["table", "metrics"],
    additionalProperties: false
} as const

const PARAM_PATTERN = /^\$([a-z][a-z0-9_]*)$/

function nowIso(): string {
    return new Date().toISOString()
}

export function assertViewDefinition(
    kind: ViewKind,
    definition: unknown
): QueryDefinition | AggregateDefinition {
    if (kind === "query") {
        validateAgainstSchema(queryDefinitionSchema, definition, "query definition")
        return definition as QueryDefinition
    }
    validateAgainstSchema(aggregateDefinitionSchema, definition, "aggregate definition")
    return definition as AggregateDefinition
}

export function extractViewParamNames(definition: unknown): string[] {
    const names = new Set<string>()
    collectViewParamNames(definition, names)
    return [...names].sort()
}

function collectViewParamNames(value: unknown, names: Set<string>): void {
    if (typeof value === "string") {
        const match = PARAM_PATTERN.exec(value)
        if (match?.[1]) {
            names.add(match[1])
        }
        return
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectViewParamNames(item, names)
        }
        return
    }
    if (value !== null && typeof value === "object") {
        for (const nested of Object.values(value)) {
            collectViewParamNames(nested, names)
        }
    }
}

function normalizeViewDisplayName(name: unknown): string {
    if (typeof name !== "string" || name.trim() === "") {
        throw new Error("name must be a non-empty string")
    }
    return name.trim()
}

export function saveView(input: {
    slug: string
    name: string
    kind: ViewKind
    definition: unknown
    description?: string
    scope?: string | null
}): ViewRow {
    const slug = assertSafeIdentifier(input.slug, "view")
    const displayName = normalizeViewDisplayName(input.name)
    if (input.kind !== "query" && input.kind !== "aggregate") {
        throw new Error('kind must be "query" or "aggregate"')
    }
    assertViewDefinition(input.kind, input.definition)
    const definitionJson = JSON.stringify(input.definition)
    const description = input.description ?? null
    const scopeProvided = Object.hasOwn(input, "scope")
    const timestamp = nowIso()
    const database = getDatabase()
    const existing = database
        .query<ViewRow, [string]>(`${VIEW_ROW_SELECT} WHERE slug = ?`)
        .get(slug)

    if (existing) {
        const scope = scopeProvided ? normalizeScope(input.scope) : existing.scope
        database
            .query(
                "UPDATE _views SET name = ?, kind = ?, definition_json = ?, description = ?, scope = ?, updated_at = ? WHERE slug = ?"
            )
            .run(displayName, input.kind, definitionJson, description, scope, timestamp, slug)
        return {
            slug,
            name: displayName,
            kind: input.kind,
            definition_json: definitionJson,
            description,
            scope,
            created_at: existing.created_at,
            updated_at: timestamp
        }
    }

    const scope = requireScope(scopeProvided ? input.scope : undefined, {
        entity: "view"
    })

    database
        .query(
            "INSERT INTO _views (slug, name, kind, definition_json, description, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
            slug,
            displayName,
            input.kind,
            definitionJson,
            description,
            scope,
            timestamp,
            timestamp
        )
    return {
        slug,
        name: displayName,
        kind: input.kind,
        definition_json: definitionJson,
        description,
        scope,
        created_at: timestamp,
        updated_at: timestamp
    }
}

export type ListViewsFilter = {
    kind?: ViewKind
    scope?: string | null
    slug_prefix?: string
    limit?: number
    offset?: number
}

export function listViews(filter: ListViewsFilter = {}): {
    views: ViewRow[]
    count: number
    limit: number
    offset: number
    has_more: boolean
} {
    const { limit, offset } = resolvePage(filter.limit, filter.offset)
    const clauses: string[] = []
    const values: unknown[] = []

    if (filter.kind !== undefined) {
        if (filter.kind !== "query" && filter.kind !== "aggregate") {
            throw new Error('kind must be "query" or "aggregate"')
        }
        clauses.push("kind = ?")
        values.push(filter.kind)
    }
    if (filter.scope !== undefined) {
        const scope = normalizeScope(filter.scope)
        if (scope === null) {
            clauses.push("scope IS NULL")
        } else {
            clauses.push("scope = ?")
            values.push(scope)
        }
    }
    if (filter.slug_prefix !== undefined && filter.slug_prefix !== "") {
        if (typeof filter.slug_prefix !== "string") {
            throw new Error("slug_prefix must be a string")
        }
        clauses.push("slug LIKE ?")
        values.push(`${filter.slug_prefix.replaceAll("%", "").replaceAll("_", "")}%`)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""
    const rows = getDatabase()
        .query<ViewRow, SQLQueryBindings[]>(
            `${VIEW_ROW_SELECT} ${where} ORDER BY slug LIMIT ? OFFSET ?`
        )
        .all(...asBindings([...values, limit + 1, offset]))

    const page = pageFromRows(rows, limit, offset)
    return {
        views: page.items,
        count: page.count,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more
    }
}

export function getView(slug: string): ViewRow | null {
    const viewSlug = assertSafeIdentifier(slug, "view")
    return (
        getDatabase().query<ViewRow, [string]>(`${VIEW_ROW_SELECT} WHERE slug = ?`).get(viewSlug) ??
        null
    )
}

export function deleteView(slug: string): void {
    const viewSlug = assertSafeIdentifier(slug, "view")
    const result = getDatabase().query("DELETE FROM _views WHERE slug = ?").run(viewSlug)
    if (result.changes === 0) {
        throw new Error(`View "${viewSlug}" does not exist`)
    }
}

export function substituteParams<T>(value: T, params: Record<string, unknown>): T {
    if (typeof value === "string") {
        const match = PARAM_PATTERN.exec(value)
        if (match) {
            const paramName = match[1]
            if (!paramName || !(paramName in params)) {
                throw new Error(`Missing query param "$${paramName}"`)
            }
            return params[paramName] as T
        }
        return value
    }
    if (Array.isArray(value)) {
        return value.map((item) => substituteParams(item, params)) as T
    }
    if (value !== null && typeof value === "object") {
        const result: Record<string, unknown> = {}
        for (const [key, nested] of Object.entries(value)) {
            result[key] = substituteParams(nested, params)
        }
        return result as T
    }
    return value
}
