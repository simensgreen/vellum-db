import type { JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../db.ts";
import { deleteRows } from "./delete.ts";
import { insertRow } from "./rows.ts";
import { requireTable } from "./catalog.ts";
import { invalidationTagsForRowMutation } from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";
import { isUserTableName, recordStatsDelta } from "./stats-store.ts";
import { resolveRowIdFilter, rowIdInFilter } from "./row-id-filter.ts";
import { updateRows } from "./update.ts";

export type RowCommitInput = {
  table: string;
  insert?: Array<Record<string, unknown>>;
  update?: Record<string, Record<string, unknown>>;
  delete?: string[];
};

export type RowCommitResult = {
  table: string;
  updated: number;
  inserted: number;
  deleted: number;
};

function assertHasChanges(input: RowCommitInput): void {
  const changeCount =
    Object.keys(input.update ?? {}).length +
    (input.insert?.length ?? 0) +
    (input.delete?.length ?? 0);
  if (changeCount === 0) {
    throw new Error("commit requires at least one change");
  }
}

export function commitRowChanges(input: RowCommitInput): RowCommitResult {
  requireTable(input.table);
  assertHasChanges(input);

  const database = getDatabase();
  database.run("BEGIN");

  try {
    let updated = 0;
    let inserted = 0;
    let deleted = 0;

    for (const [rowId, patch] of Object.entries(input.update ?? {})) {
      const result = updateRows({
        table: input.table,
        filter: resolveRowIdFilter(input.table, { id: rowId } as JsonFilter),
        patch,
        sideEffects: false,
      });
      updated += result.changes;
    }

    for (const row of input.insert ?? []) {
      const result = insertRow({
        table: input.table,
        row,
        sideEffects: false,
      });
      if (result.outcome !== "ignored") {
        inserted += 1;
      }
    }

    if (input.delete && input.delete.length > 0) {
      const result = deleteRows({
        table: input.table,
        filter: rowIdInFilter(input.table, input.delete),
        sideEffects: false,
      });
      deleted += result.changes;
    }

    database.run("COMMIT");

    if (updated + inserted + deleted > 0) {
      notifyInvalidation(invalidationTagsForRowMutation(input.table));
      if (isUserTableName(input.table)) {
        recordStatsDelta({
          updates: updated,
          inserts: inserted,
          deletions: deleted,
        });
      }
    }

    return {
      table: input.table,
      updated,
      inserted,
      deleted,
    };
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
}
