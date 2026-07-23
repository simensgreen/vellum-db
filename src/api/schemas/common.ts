import type { JsonFilter } from "@truto/sqlite-builder"
import { z } from "../zod.ts"

export const TableNameSchema = z.string().min(1, {
    message: "Missing query parameter: table"
})

export const ScopeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, {
    message: "scope must match [a-z][a-z0-9_]*"
})

export const OnConflictSchema = z.enum(["abort", "ignore", "replace"], {
    message: 'on_conflict must be "abort", "ignore", or "replace"'
})

export const IoModeSchema = z.enum(["csv", "json", "jsonl", "xlsx"], {
    message: 'mode must be "csv", "json", "jsonl", or "xlsx"'
})

export const ViewKindSchema = z.enum(["query", "aggregate"], {
    message: 'kind must be "query" or "aggregate"'
})

export const JsonFilterSchema: z.ZodType<JsonFilter> = z.record(
    z.string(),
    z.unknown()
) as z.ZodType<JsonFilter>

export const TableJsonSchemaSchema = z.record(z.string(), z.unknown())

export const RowRecordSchema = z.record(z.string(), z.unknown())

export const OrderSpecSchema = z.object({
    column: z.string(),
    direction: z.enum(["asc", "desc"]).optional()
})

export const JoinTypeSchema = z.enum(["left", "inner", "right"])

export const RefJoinSpecSchema = z.object({
    ref: z.string(),
    source: z.string().optional(),
    type: JoinTypeSchema.optional(),
    select: z.record(z.string(), z.string())
})

export const AggregateMetricSchema = z.object({
    fn: z.enum(["count", "sum", "avg", "min", "max"]),
    column: z.string().optional(),
    as: z.string()
})

export function requiredQueryString(parameterName: string) {
    return z.string().min(1, {
        message: `Missing query parameter: ${parameterName}`
    })
}

export const PaginationQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .positive({ message: "limit must be a positive integer" })
        .optional(),
    offset: z.coerce
        .number()
        .int()
        .nonnegative({ message: "offset must be a non-negative integer" })
        .optional()
})
