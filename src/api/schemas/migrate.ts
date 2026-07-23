import { z } from "../zod.ts"
import { OnConflictSchema, ScopeSchema } from "./common.ts"

export const MigrationVersionSchema = z.literal(1)

export const MigrationCreateEntrySchema = z.object({
    scope: ScopeSchema,
    definition: z.record(z.string(), z.unknown())
})

export const MigrationAlterEntrySchema = z.object({
    table: z.string().min(1),
    add: z
        .array(
            z.object({
                name: z.string(),
                slug: z.string(),
                column: z.record(z.string(), z.unknown())
            })
        )
        .optional(),
    drop: z.array(z.string()).optional(),
    scope: ScopeSchema.nullable().optional()
})

export const MigrationSeedEntrySchema = z.object({
    table: z.string().min(1),
    rows: z.array(z.record(z.string(), z.unknown())).min(1),
    on_conflict: OnConflictSchema.optional()
})

export const MigrationViewEntrySchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["query", "aggregate"]),
    definition: z.record(z.string(), z.unknown()),
    description: z.string().optional(),
    scope: ScopeSchema
})

export const MigrationFileSchema = z
    .object({
        version: MigrationVersionSchema,
        create: z.array(MigrationCreateEntrySchema).optional(),
        alter: z.array(MigrationAlterEntrySchema).optional(),
        drop: z.array(z.string().min(1)).optional(),
        seed: z.array(MigrationSeedEntrySchema).optional(),
        views: z.array(MigrationViewEntrySchema).optional(),
        delete_views: z.array(z.string().min(1)).optional()
    })
    .superRefine((value, context) => {
        const sectionCount =
            (value.create?.length ?? 0) +
            (value.alter?.length ?? 0) +
            (value.drop?.length ?? 0) +
            (value.seed?.length ?? 0) +
            (value.views?.length ?? 0) +
            (value.delete_views?.length ?? 0)
        if (sectionCount === 0) {
            context.addIssue({
                code: "custom",
                message: "Migration must include at least one operation section"
            })
        }
    })

export const ApplyMigrationBodySchema = z
    .object({
        path: z.string().min(1).optional(),
        hash: z.string().min(1).optional(),
        id: z.coerce.number().int().positive().optional()
    })
    .superRefine((value, context) => {
        const selectorCount = (value.path ? 1 : 0) + (value.hash ? 1 : 0) + (value.id ? 1 : 0)
        if (selectorCount !== 1) {
            context.addIssue({
                code: "custom",
                message: "Provide exactly one of path, hash, or id"
            })
        }
    })

export const ListMigrationsQuerySchema = z.object({
    limit: z.coerce.number().int().positive().optional(),
    offset: z.coerce.number().int().nonnegative().optional()
})

export type MigrationFile = z.infer<typeof MigrationFileSchema>
