import { z } from "../zod.ts";
import {
  IoModeSchema,
  OnConflictSchema,
  requiredQueryString,
  TableNameSchema,
} from "./common.ts";

export const LoadTableQuerySchema = z.object({
  table: TableNameSchema,
  path: requiredQueryString("path"),
  mode: IoModeSchema,
  on_conflict: OnConflictSchema.optional(),
});

export const DumpTableQuerySchema = z.object({
  table: TableNameSchema,
  path: requiredQueryString("path"),
  mode: IoModeSchema,
});

export const ExportTableQuerySchema = z.object({
  table: TableNameSchema,
  mode: IoModeSchema,
});

export const ImportTableQuerySchema = z
  .object({
    table: TableNameSchema,
    mode: IoModeSchema.optional(),
    filename: z.string().min(1).optional(),
    on_conflict: OnConflictSchema.optional(),
  })
  .superRefine((value, context) => {
    if (!value.mode && !value.filename) {
      context.addIssue({
        code: "custom",
        message: "Provide query parameter mode or filename",
        path: ["mode"],
      });
    }
  });
