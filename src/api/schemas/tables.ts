import { z } from "../zod.ts"
import { PaginationQuerySchema, ScopeSchema, TableNameSchema } from "./common.ts"

export const ListTablesQuerySchema = PaginationQuerySchema.extend({
    name_prefix: z.string().optional()
})

export const AlterTableQuerySchema = z.object({
    table: TableNameSchema
})

export const AlterTableBodySchema = z.object({
    add: z
        .array(
            z.object({
                name: z.string(),
                slug: z.string(),
                column: z.record(z.string(), z.unknown())
            })
        )
        .optional(),
    drop: z.array(z.string()).optional()
})

export const DropTableQuerySchema = z.object({
    table: TableNameSchema
})

export const CreateTableScopeQuerySchema = z.object({
    scope: ScopeSchema
})
