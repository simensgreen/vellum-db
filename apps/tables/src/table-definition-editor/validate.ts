import { ApiError } from "vellum-db/api/errors";
import { assertTableDefinition } from "vellum-db/core/table/index";
import type { TableDefinition } from "vellum-db/core/table/types";
import { visualToTableDefinition } from "./build.ts";
import type { VisualTable } from "./types.ts";

export type ValidationResult =
  | { ok: true; definition: TableDefinition }
  | { ok: false; msg: string; hint?: string };

export function validateVisualTable(
  visual: VisualTable,
  knownTables?: Map<string, TableDefinition>,
): ValidationResult {
  const definition = visualToTableDefinition(visual);
  try {
    assertTableDefinition(definition, { knownTables });
    return { ok: true, definition };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = error instanceof ApiError ? error.hint : undefined;
    return { ok: false, msg: message, hint };
  }
}
