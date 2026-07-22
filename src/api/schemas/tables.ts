import { z } from "../zod.ts";
import {
  PaginationQuerySchema,
  requiredQueryString,
  TableJsonSchemaSchema,
  TableNameSchema,
} from "./common.ts";

export const ListTablesQuerySchema = PaginationQuerySchema.extend({
  name_prefix: z.string().optional(),
});

export const CreateTableQuerySchema = z.object({
  name: requiredQueryString("name"),
});

export const CreateTableBodySchema = TableJsonSchemaSchema;

export const AlterTableQuerySchema = z.object({
  table: TableNameSchema,
});

export const AlterTableBodySchema = z.object({
  add: z
    .array(
      z.object({
        name: z.string(),
        schema: TableJsonSchemaSchema,
      }),
    )
    .optional(),
  drop: z.array(z.string()).optional(),
});

export const DropTableQuerySchema = z.object({
  table: TableNameSchema,
});
