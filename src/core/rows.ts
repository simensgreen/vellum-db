import { getConfig } from "../db.ts";
import {
  insertTableRow,
  parseOnConflict,
  type InsertOutcome,
  type OnConflict,
} from "./insert.ts";
import { requireTable, type TableRow } from "./catalog.ts";
import { invalidationTagsForRowMutation } from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";

export type { OnConflict, InsertOutcome };

export function insertRow(input: {
  table: string;
  row: Record<string, unknown>;
  on_conflict?: OnConflict;
}) {
  const table = requireTable(input.table);
  const onConflict = parseOnConflict(input.on_conflict);
  const result = insertTableRow(table, input.row, onConflict);
  if (result.outcome !== "ignored") {
    notifyInvalidation(invalidationTagsForRowMutation(table.name));
  }
  return {
    table: table.name,
    id: result.id,
    changes: result.changes,
    outcome: result.outcome,
    on_conflict: onConflict,
  };
}

export { insertTableRow, parseOnConflict, requireTable, type TableRow };
