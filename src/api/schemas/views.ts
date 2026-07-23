import { z } from "../zod.ts"
import {
    PaginationQuerySchema,
    RowRecordSchema,
    requiredQueryString,
    ScopeSchema,
    ViewKindSchema
} from "./common.ts"
import { optionalJsonQueryString } from "./json-query.ts"

export const ListViewsQuerySchema = PaginationQuerySchema.extend({
    kind: ViewKindSchema.optional(),
    slug_prefix: z.string().optional()
})

export const SaveViewQuerySchema = z.object({
    slug: requiredQueryString("slug"),
    name: requiredQueryString("name"),
    kind: ViewKindSchema,
    description: z.string().optional(),
    scope: ScopeSchema
})

export const SaveViewBodySchema = RowRecordSchema

export const RunViewQuerySchema = z.object({
    slug: requiredQueryString("slug"),
    params: optionalJsonQueryString("params").pipe(z.record(z.string(), z.unknown()).optional())
})

export const DeleteViewQuerySchema = z.object({
    slug: requiredQueryString("slug")
})
