import { executeAggregateDefinition } from "./aggregate.ts"
import { executeQueryDefinition } from "./query.ts"
import type { AggregateDefinition, QueryDefinition } from "./query-compile.ts"
import { notifyInvalidation } from "./sync.ts"
import { invalidationTagsForViewsChange } from "./sync-tags.ts"
import {
    deleteView,
    extractViewParamNames,
    getView,
    listViews,
    saveView,
    substituteParams,
    type ViewKind
} from "./views.ts"

export type { ViewKind }

export function listViewsView(input: {
    kind?: ViewKind
    scope?: string | null
    slug_prefix?: string
    limit?: number
    offset?: number
}) {
    const page = listViews(input)
    return {
        views: page.views.map((row) => {
            const definition = JSON.parse(row.definition_json)
            return {
                slug: row.slug,
                name: row.name,
                kind: row.kind,
                scope: row.scope,
                description: row.description,
                definition,
                param_names: extractViewParamNames(definition),
                created_at: row.created_at,
                updated_at: row.updated_at
            }
        }),
        count: page.count,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more
    }
}

export function saveViewApi(input: {
    slug: string
    name: string
    kind: ViewKind
    definition: unknown
    description?: string
    scope?: string | null
}) {
    const saved = saveView(input)
    notifyInvalidation(invalidationTagsForViewsChange())
    const definition = JSON.parse(saved.definition_json)
    return {
        slug: saved.slug,
        name: saved.name,
        kind: saved.kind,
        scope: saved.scope,
        description: saved.description,
        definition,
        param_names: extractViewParamNames(definition),
        updated_at: saved.updated_at
    }
}

export function deleteViewBySlug(slug: string) {
    deleteView(slug)
    notifyInvalidation(invalidationTagsForViewsChange())
    return { deleted: slug }
}

export function runView(input: { slug: string; params?: Record<string, unknown> }) {
    const saved = getView(input.slug)
    if (!saved) {
        throw new Error(`View "${input.slug}" does not exist`)
    }
    const params = input.params ?? {}
    const definition = substituteParams(JSON.parse(saved.definition_json), params)
    const kind = saved.kind as ViewKind
    if (kind === "query") {
        return {
            slug: saved.slug,
            name: saved.name,
            kind,
            result: executeQueryDefinition(definition as QueryDefinition)
        }
    }
    return {
        slug: saved.slug,
        name: saved.name,
        kind,
        result: executeAggregateDefinition(definition as AggregateDefinition)
    }
}
