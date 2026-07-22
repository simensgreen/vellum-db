import { z } from "../api/zod.ts";
import { TableJsonSchemaSchema } from "../api/schemas/common.ts";

export const responseSchemas = {
  ErrorSchema: z.object({
    error: z.string(),
  }),
  PaginatedMetaSchema: z.object({
    count: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    has_more: z.boolean(),
  }),
  TableSummarySchema: z.object({
    name: z.string(),
    scope: z.string().nullable(),
    schema: TableJsonSchemaSchema,
    columns: z.array(
      z.object({
        name: z.string(),
        sql_type: z.string(),
        nullable: z.boolean(),
      }),
    ),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  QueryResultSchema: z.object({
    count: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    has_more: z.boolean(),
    rows: z.array(z.record(z.string(), z.unknown())),
  }),
  SuccessResponseSchema: z.record(z.string(), z.unknown()),
};

export const errorResponses = {
  400: {
    description: "Invalid input",
    content: { "application/json": { schema: responseSchemas.ErrorSchema } },
  },
  403: {
    description: "Forbidden (config gate or auth)",
    content: { "application/json": { schema: responseSchemas.ErrorSchema } },
  },
  404: {
    description: "Not found",
    content: { "application/json": { schema: responseSchemas.ErrorSchema } },
  },
  500: {
    description: "Internal error",
    content: { "application/json": { schema: responseSchemas.ErrorSchema } },
  },
} as const;

export const successResponses = {
  200: {
    description: "Success",
    content: { "application/json": { schema: responseSchemas.SuccessResponseSchema } },
  },
  ...errorResponses,
} as const;
