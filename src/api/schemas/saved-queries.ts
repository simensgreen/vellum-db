import { z } from "../zod.ts";
import {
  PaginationQuerySchema,
  requiredQueryString,
  RowRecordSchema,
  SavedQueryKindSchema,
} from "./common.ts";
import { optionalJsonQueryString } from "./json-query.ts";

export const ListSavedQueriesQuerySchema = PaginationQuerySchema.extend({
  kind: SavedQueryKindSchema.optional(),
  name_prefix: z.string().optional(),
});

export const SaveSavedQueryQuerySchema = z.object({
  name: requiredQueryString("name"),
  kind: SavedQueryKindSchema,
  description: z.string().optional(),
});

export const SaveSavedQueryBodySchema = RowRecordSchema;

export const RunSavedQueryQuerySchema = z.object({
  name: requiredQueryString("name"),
  params: optionalJsonQueryString("params").pipe(
    z.record(z.string(), z.unknown()).optional(),
  ),
});

export const DeleteSavedQueryQuerySchema = z.object({
  name: requiredQueryString("name"),
});
