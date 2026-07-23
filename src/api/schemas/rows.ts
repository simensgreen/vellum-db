import { z } from "../zod.ts";
import {
  AggregateMetricSchema,
  JsonFilterSchema,
  OnConflictSchema,
  OrderSpecSchema,
  PaginationQuerySchema,
  RefJoinSpecSchema,
  RowRecordSchema,
  TableNameSchema,
} from "./common.ts";
import {
  optionalJsonQueryString,
  requiredJsonQueryString,
} from "./json-query.ts";

export const QueryRowsQuerySchema = PaginationQuerySchema.extend({
  table: TableNameSchema,
  filter: optionalJsonQueryString("filter").pipe(JsonFilterSchema.optional()),
  order: optionalJsonQueryString("order").pipe(z.array(OrderSpecSchema).optional()),
  columns: optionalJsonQueryString("columns").pipe(z.array(z.string()).optional()),
  joins: optionalJsonQueryString("joins").pipe(z.array(RefJoinSpecSchema).optional()),
});

export const InsertRowQuerySchema = z.object({
  table: TableNameSchema,
  on_conflict: OnConflictSchema.optional(),
});

export const InsertRowBodySchema = RowRecordSchema;

export const UpdateRowsQuerySchema = z.object({
  table: TableNameSchema,
});

export const UpdateRowsBodySchema = z.object({
  filter: JsonFilterSchema,
  patch: RowRecordSchema,
});

export const DeleteRowsQuerySchema = z.object({
  table: TableNameSchema,
});

export const DeleteRowsBodySchema = z.object({
  filter: JsonFilterSchema,
});

const NonEmptyRowPatchSchema = RowRecordSchema.refine(
  (patch) => Object.keys(patch).length > 0,
  { message: "patch must contain at least one field" },
);

export const RowCommitQuerySchema = z.object({
  table: TableNameSchema,
});

export const RowCommitBodySchema = z
  .object({
    insert: z.array(RowRecordSchema).default([]),
    update: z
      .record(z.string().min(1), NonEmptyRowPatchSchema)
      .default({}),
    delete: z.array(z.string().min(1)).default([]),
  })
  .refine(
    (body) =>
      body.insert.length + Object.keys(body.update).length + body.delete.length >
      0,
    { message: "commit requires at least one change" },
  );

export const AggregateRowsQuerySchema = PaginationQuerySchema.extend({
  table: TableNameSchema,
  metrics: requiredJsonQueryString("metrics").pipe(
    z.array(AggregateMetricSchema).min(1, {
      message: "metrics must be a non-empty JSON array",
    }),
  ),
  group_by: optionalJsonQueryString("group_by").pipe(z.array(z.string()).optional()),
  filter: optionalJsonQueryString("filter").pipe(JsonFilterSchema.optional()),
  having: optionalJsonQueryString("having").pipe(JsonFilterSchema.optional()),
  order: optionalJsonQueryString("order").pipe(z.array(OrderSpecSchema).optional()),
  joins: optionalJsonQueryString("joins").pipe(z.array(RefJoinSpecSchema).optional()),
});
