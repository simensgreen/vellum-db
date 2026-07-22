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
