import "./zod.ts";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  IoModeSchema,
  JsonFilterSchema,
  OnConflictSchema,
  RowRecordSchema,
  ScopeSchema,
  TableJsonSchemaSchema,
} from "../api/schemas/common.ts";
import {
  AggregateRowsQuerySchema,
  DeleteRowsBodySchema,
  DeleteRowsQuerySchema,
  InsertRowQuerySchema,
  QueryRowsQuerySchema,
  UpdateRowsBodySchema,
  UpdateRowsQuerySchema,
} from "../api/schemas/rows.ts";
import {
  AlterTableBodySchema,
  AlterTableQuerySchema,
  CreateTableBodySchema,
  CreateTableQuerySchema,
  DropTableQuerySchema,
  ListTablesQuerySchema,
} from "../api/schemas/tables.ts";
import {
  DeleteSavedQueryQuerySchema,
  ListSavedQueriesQuerySchema,
  RunSavedQueryQuerySchema,
  SaveSavedQueryBodySchema,
  SaveSavedQueryQuerySchema,
} from "../api/schemas/saved-queries.ts";
import {
  DumpTableQuerySchema,
  LoadTableQuerySchema,
} from "../api/schemas/io.ts";
import { ExecuteSqlBodySchema } from "../api/schemas/sql.ts";
import { errorResponses, responseSchemas, successResponses } from "./responses.ts";

export function createOpenApiRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  registry.register("Error", responseSchemas.ErrorSchema);
  registry.register("PaginatedMeta", responseSchemas.PaginatedMetaSchema);
  registry.register("TableSummary", responseSchemas.TableSummarySchema);
  registry.register("QueryResult", responseSchemas.QueryResultSchema);
  registry.register("OnConflict", OnConflictSchema);
  registry.register("IoMode", IoModeSchema);
  registry.register("JsonFilter", JsonFilterSchema);
  registry.register("JsonSchema", TableJsonSchemaSchema);

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
              tables: responseSchemas.TableSummarySchema.array(),
            }),
          },
        },
      },
      ...errorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/tables",
    operationId: "createTable",
    summary: "Create a structured table",
    tags: ["tables"],
    request: {
      query: CreateTableQuerySchema.extend({ scope: ScopeSchema.optional() }),
      body: {
        content: { "application/json": { schema: CreateTableBodySchema } },
        description: "JSON Schema for row columns (excluding id)",
      },
    },
    responses: successResponses,
  });

  registry.registerPath({
    method: "post",
    path: "/tables/alter",
    operationId: "alterTable",
    summary: "Alter a structured table",
    tags: ["tables"],
    request: {
      query: AlterTableQuerySchema.extend({ scope: ScopeSchema.optional() }),
      body: { content: { "application/json": { schema: AlterTableBodySchema } } },
    },
    responses: successResponses,
  });

  registry.registerPath({
    method: "delete",
    path: "/tables/drop",
    operationId: "dropTable",
    summary: "Drop a structured table",
    description: "Requires config.allowDropTable = true",
    tags: ["tables"],
    request: { query: DropTableQuerySchema },
    responses: successResponses,
  });

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
        content: { "application/json": { schema: responseSchemas.QueryResultSchema } },
      },
      ...errorResponses,
    },
  });

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
              description: "Row fields (id optional; nanoid generated when omitted)",
            }),
          },
        },
      },
    },
    responses: successResponses,
  });

  registry.registerPath({
    method: "patch",
    path: "/rows",
    operationId: "updateRows",
    summary: "Update rows matching a filter",
    tags: ["rows"],
    request: {
      query: UpdateRowsQuerySchema,
      body: { content: { "application/json": { schema: UpdateRowsBodySchema } } },
    },
    responses: successResponses,
  });

  registry.registerPath({
    method: "delete",
    path: "/rows",
    operationId: "deleteRows",
    summary: "Delete rows matching a filter",
    tags: ["rows"],
    request: {
      query: DeleteRowsQuerySchema,
      body: { content: { "application/json": { schema: DeleteRowsBodySchema } } },
    },
    responses: successResponses,
  });

  registry.registerPath({
    method: "get",
    path: "/aggregate",
    operationId: "aggregateRows",
    summary: "Aggregate table rows",
    tags: ["aggregate"],
    request: { query: AggregateRowsQuerySchema },
    responses: successResponses,
  });

  registry.registerPath({
    method: "get",
    path: "/saved-queries",
    operationId: "listSavedQueries",
    summary: "List saved named queries",
    tags: ["saved-queries"],
    request: { query: ListSavedQueriesQuerySchema },
    responses: successResponses,
  });

  registry.registerPath({
    method: "post",
    path: "/saved-queries",
    operationId: "saveQuery",
    summary: "Save a named query or aggregate",
    tags: ["saved-queries"],
    request: {
      query: SaveSavedQueryQuerySchema,
      body: {
        content: {
          "application/json": {
            schema: SaveSavedQueryBodySchema.meta({
              description:
                "Query or aggregate definition (same shape as db_query / db_aggregate input)",
            }),
          },
        },
      },
    },
    responses: successResponses,
  });

  registry.registerPath({
    method: "get",
    path: "/saved-queries/run",
    operationId: "runSavedQuery",
    summary: "Run a saved named query",
    tags: ["saved-queries"],
    request: { query: RunSavedQueryQuerySchema },
    responses: successResponses,
  });

  registry.registerPath({
    method: "delete",
    path: "/saved-queries/delete",
    operationId: "deleteSavedQuery",
    summary: "Delete a saved named query",
    tags: ["saved-queries"],
    request: { query: DeleteSavedQueryQuerySchema },
    responses: successResponses,
  });

  registry.registerPath({
    method: "post",
    path: "/load",
    operationId: "loadTable",
    summary: "Load rows from a workspace file",
    tags: ["io"],
    request: { query: LoadTableQuerySchema },
    responses: successResponses,
  });

  registry.registerPath({
    method: "post",
    path: "/dump",
    operationId: "dumpTable",
    summary: "Dump table rows to a workspace file",
    tags: ["io"],
    request: { query: DumpTableQuerySchema },
    responses: successResponses,
  });

  registry.registerPath({
    method: "post",
    path: "/sql",
    operationId: "executeSql",
    summary: "Run raw SQL",
    description:
      "Gated by config.rawSqlMode: off (403), select-only (SELECT only), on (single statement)",
    tags: ["sql"],
    request: {
      body: { content: { "application/json": { schema: ExecuteSqlBodySchema } } },
    },
    responses: successResponses,
  });

  return registry;
}

export const registeredRoutePaths = [
  "/tables",
  "/tables/alter",
  "/tables/drop",
  "/rows",
  "/aggregate",
  "/saved-queries",
  "/saved-queries/run",
  "/saved-queries/delete",
  "/load",
  "/dump",
  "/sql",
] as const;
