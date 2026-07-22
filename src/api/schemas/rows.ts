import { z } from "../zod.ts";
import {
  AggregateMetricSchema,
  JsonFilterSchema,
  OnConflictSchema,
  OrderSpecSchema,
  PaginationQuerySchema,
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
});
