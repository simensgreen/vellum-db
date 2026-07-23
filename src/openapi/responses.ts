import { z } from "../api/zod.ts"

export const responseSchemas = {
    ApiErrorSchema: z.object({
        type: z.string(),
        msg: z.string().optional(),
        hint: z.string().optional()
    }),
    PaginatedMetaSchema: z.object({
        count: z.number().int().nonnegative(),
        limit: z.number().int().positive(),
        offset: z.number().int().nonnegative(),
        has_more: z.boolean()
    }),
    TableDefinitionSchema: z.record(z.string(), z.unknown()).meta({
        description: "TableDefinition DSL (slug, name, columns with primaryKey)"
    }),
    TableSummarySchema: z.object({
        name: z.string(),
        scope: z.string().nullable(),
        definition: z.record(z.string(), z.unknown()),
        columns: z.array(
            z.object({
                name: z.string(),
                sqlType: z.enum(["TEXT", "INTEGER", "REAL"]),
                notNull: z.boolean(),
                jsonStored: z.boolean()
            })
        ),
        created_at: z.string(),
        updated_at: z.string()
    }),
    QueryResultSchema: z.object({
        count: z.number().int().nonnegative(),
        total_count: z.number().int().nonnegative(),
        limit: z.number().int().positive(),
        offset: z.number().int().nonnegative(),
        has_more: z.boolean(),
        rows: z.array(z.record(z.string(), z.unknown()))
    }),
    SuccessResponseSchema: z.record(z.string(), z.unknown())
}

export const errorResponses = {
    400: {
        description: "Invalid input",
        content: { "application/json": { schema: responseSchemas.ApiErrorSchema } }
    },
    403: {
        description: "Forbidden (config gate or auth)",
        content: { "application/json": { schema: responseSchemas.ApiErrorSchema } }
    },
    404: {
        description: "Not found",
        content: { "application/json": { schema: responseSchemas.ApiErrorSchema } }
    },
    500: {
        description: "Internal error",
        content: { "application/json": { schema: responseSchemas.ApiErrorSchema } }
    }
} as const

export const successResponses = {
    200: {
        description: "Success",
        content: { "application/json": { schema: responseSchemas.SuccessResponseSchema } }
    },
    ...errorResponses
} as const

/** @deprecated use ApiErrorSchema */
export const ErrorSchema = responseSchemas.ApiErrorSchema
