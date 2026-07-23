import "./zod.ts"
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi"
import {
    IoModeSchema,
    JsonFilterSchema,
    OnConflictSchema,
    RowRecordSchema,
    ScopeSchema
} from "../api/schemas/common.ts"
import {
    DumpTableQuerySchema,
    ExportTableQuerySchema,
    ImportTableQuerySchema,
    LoadTableQuerySchema
} from "../api/schemas/io.ts"
import { ApplyMigrationBodySchema, ListMigrationsQuerySchema } from "../api/schemas/migrate.ts"
import {
    AggregateRowsQuerySchema,
    DeleteRowsBodySchema,
    DeleteRowsQuerySchema,
    InsertRowQuerySchema,
    QueryRowsQuerySchema,
    RowCommitBodySchema,
    RowCommitQuerySchema,
    UpdateRowsBodySchema,
    UpdateRowsQuerySchema
} from "../api/schemas/rows.ts"
import { ExecuteSqlBodySchema } from "../api/schemas/sql.ts"
import { DatabaseStatsSchema, StatsQuerySchema } from "../api/schemas/stats.ts"
import {
    AlterTableBodySchema,
    AlterTableQuerySchema,
    CreateTableScopeQuerySchema,
    DropTableQuerySchema,
    ListTablesQuerySchema
} from "../api/schemas/tables.ts"
import {
    DeleteViewQuerySchema,
    ListViewsQuerySchema,
    RunViewQuerySchema,
    SaveViewBodySchema,
    SaveViewQuerySchema
} from "../api/schemas/views.ts"
import { z } from "../api/zod.ts"
import { errorResponses, responseSchemas, successResponses } from "./responses.ts"

export function createOpenApiRegistry(): OpenAPIRegistry {
    const registry = new OpenAPIRegistry()

    registry.register("Error", responseSchemas.ApiErrorSchema)
    registry.register("PaginatedMeta", responseSchemas.PaginatedMetaSchema)
    registry.register("TableSummary", responseSchemas.TableSummarySchema)
    registry.register("QueryResult", responseSchemas.QueryResultSchema)
    registry.register("OnConflict", OnConflictSchema)
    registry.register("IoMode", IoModeSchema)
    registry.register("JsonFilter", JsonFilterSchema)
    registry.register("TableDefinition", responseSchemas.TableDefinitionSchema)

    registry.registerPath({
        method: "get",
        path: "/tables",
        operationId: "listTables",
        summary: "List structured tables",
        tags: ["tables"],
        request: { query: ListTablesQuerySchema.extend({ scope: ScopeSchema.optional() }) },
        responses: {
            200: {
                description: "Paginated table list",
                content: {
                    "application/json": {
                        schema: responseSchemas.PaginatedMetaSchema.extend({
                            tables: responseSchemas.TableSummarySchema.array()
                        })
                    }
                }
            },
            ...errorResponses
        }
    })

    registry.registerPath({
        method: "post",
        path: "/tables",
        operationId: "createTable",
        summary: "Create a structured table",
        tags: ["tables"],
        request: {
            query: CreateTableScopeQuerySchema,
            body: {
                content: {
                    "application/json": { schema: responseSchemas.TableDefinitionSchema }
                },
                description: "TableDefinition DSL"
            }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "post",
        path: "/tables/alter",
        operationId: "alterTable",
        summary: "Alter a structured table",
        tags: ["tables"],
        request: {
            query: AlterTableQuerySchema.extend({ scope: ScopeSchema.optional() }),
            body: { content: { "application/json": { schema: AlterTableBodySchema } } }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "delete",
        path: "/tables/drop",
        operationId: "dropTable",
        summary: "Drop a structured table",
        description: "Requires config.allowDropTable = true",
        tags: ["tables"],
        request: { query: DropTableQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "get",
        path: "/rows",
        operationId: "queryRows",
        summary: "Query table rows",
        tags: ["rows"],
        request: { query: QueryRowsQuerySchema },
        responses: {
            200: {
                description: "Query result",
                content: { "application/json": { schema: responseSchemas.QueryResultSchema } }
            },
            ...errorResponses
        }
    })

    registry.registerPath({
        method: "post",
        path: "/rows",
        operationId: "insertRow",
        summary: "Insert a row",
        tags: ["rows"],
        request: {
            query: InsertRowQuerySchema,
            body: {
                content: {
                    "application/json": {
                        schema: RowRecordSchema.meta({
                            description:
                                "Row fields; primary key columns optional when defaults apply"
                        })
                    }
                }
            }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "patch",
        path: "/rows",
        operationId: "updateRows",
        summary: "Update rows matching a filter",
        tags: ["rows"],
        request: {
            query: UpdateRowsQuerySchema,
            body: { content: { "application/json": { schema: UpdateRowsBodySchema } } }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "delete",
        path: "/rows",
        operationId: "deleteRows",
        summary: "Delete rows matching a filter",
        tags: ["rows"],
        request: {
            query: DeleteRowsQuerySchema,
            body: { content: { "application/json": { schema: DeleteRowsBodySchema } } }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "post",
        path: "/rows/commit",
        operationId: "commitRows",
        summary: "Apply row changes in one transaction",
        description:
            "Atomically apply updates, inserts, and deletes for a single table. All changes commit or none do.",
        tags: ["rows"],
        request: {
            query: RowCommitQuerySchema,
            body: { content: { "application/json": { schema: RowCommitBodySchema } } }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "get",
        path: "/aggregate",
        operationId: "aggregateRows",
        summary: "Aggregate table rows",
        tags: ["aggregate"],
        request: { query: AggregateRowsQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "get",
        path: "/views",
        operationId: "listViews",
        summary: "List named views",
        tags: ["views"],
        request: { query: ListViewsQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "post",
        path: "/views",
        operationId: "saveView",
        summary: "Save a named query or aggregate view",
        tags: ["views"],
        request: {
            query: SaveViewQuerySchema,
            body: {
                content: {
                    "application/json": {
                        schema: SaveViewBodySchema.meta({
                            description:
                                "Query or aggregate definition (same shape as db_query / db_aggregate input)"
                        })
                    }
                }
            }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "get",
        path: "/views/run",
        operationId: "runView",
        summary: "Run a named view",
        tags: ["views"],
        request: { query: RunViewQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "delete",
        path: "/views/delete",
        operationId: "deleteView",
        summary: "Delete a named view",
        tags: ["views"],
        request: { query: DeleteViewQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "post",
        path: "/load",
        operationId: "loadTable",
        summary: "Load rows from a workspace file",
        tags: ["io"],
        request: { query: LoadTableQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "post",
        path: "/dump",
        operationId: "dumpTable",
        summary: "Dump table rows to a workspace file",
        tags: ["io"],
        request: { query: DumpTableQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "get",
        path: "/export",
        operationId: "exportTable",
        summary: "Download table rows as a file",
        tags: ["io"],
        request: { query: ExportTableQuerySchema },
        responses: {
            200: {
                description: "Table export file",
                content: {
                    "application/octet-stream": {
                        schema: z.string().openapi({ format: "binary" })
                    }
                }
            },
            ...errorResponses
        }
    })

    registry.registerPath({
        method: "post",
        path: "/import",
        operationId: "importTable",
        summary: "Upload a file and load rows into a table",
        tags: ["io"],
        request: { query: ImportTableQuerySchema },
        responses: successResponses
    })

    registry.registerPath({
        method: "get",
        path: "/stats",
        operationId: "getDatabaseStats",
        summary: "Database overview statistics",
        tags: ["stats"],
        request: { query: StatsQuerySchema },
        responses: {
            200: {
                description: "Overview stats and time buckets",
                content: { "application/json": { schema: DatabaseStatsSchema } }
            },
            ...errorResponses
        }
    })

    registry.registerPath({
        method: "post",
        path: "/sql",
        operationId: "executeSql",
        summary: "Run raw SQL",
        description:
            "Gated by config.rawSqlMode: off (403), select-only (SELECT only), on (single statement)",
        tags: ["sql"],
        request: {
            body: { content: { "application/json": { schema: ExecuteSqlBodySchema } } }
        },
        responses: successResponses
    })

    registry.registerPath({
        method: "get",
        path: "/migrations",
        operationId: "listMigrations",
        summary: "List applied schema migrations",
        tags: ["migrations"],
        request: { query: ListMigrationsQuerySchema },
        responses: {
            200: {
                description: "Paginated migration history",
                content: {
                    "application/json": {
                        schema: responseSchemas.PaginatedMetaSchema.extend({
                            migrations: z.array(
                                z.object({
                                    id: z.number().int().positive(),
                                    hash: z.string(),
                                    name: z.string(),
                                    applied_at: z.string()
                                })
                            )
                        })
                    }
                }
            },
            ...errorResponses
        }
    })

    registry.registerPath({
        method: "post",
        path: "/migrate",
        operationId: "applyMigration",
        summary: "Apply a flat migration file or inspect a recorded migration",
        tags: ["migrations"],
        request: {
            body: {
                content: { "application/json": { schema: ApplyMigrationBodySchema } }
            }
        },
        responses: successResponses
    })

    return registry
}

export const registeredRoutePaths = [
    "/tables",
    "/tables/alter",
    "/tables/drop",
    "/rows",
    "/rows/commit",
    "/aggregate",
    "/views",
    "/views/run",
    "/views/delete",
    "/load",
    "/dump",
    "/export",
    "/import",
    "/sql",
    "/stats",
    "/migrations",
    "/migrate"
] as const
