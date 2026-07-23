import type { TableSummary } from "../api.ts";
import { parseDraftRow } from "../row-editor.ts";
import { diffPatch, mergeRowForDisplay } from "./patch-ops.ts";
import type { ColumnDefinition } from "vellum-db/core/table/types";
import type { CommitPatch, StagingPatch } from "./types.ts";
import type { RowDraft } from "../row-editor.ts";

export function patchToCommitBody(
  patch: StagingPatch,
  table: TableSummary,
  originalsByPk: ReadonlyMap<string, Record<string, unknown>>,
  columns: ColumnDefinition[],
): CommitPatch {
  const update: Record<string, Record<string, unknown>> = {};
  for (const [pk, rowPatch] of Object.entries(patch.update)) {
    const original = originalsByPk.get(pk);
    if (!original) {
      continue;
    }
    const mergedDraft = mergeRowForDisplay(original, rowPatch, columns);
    const parsedPatch = diffPatch(original, mergedDraft, columns);
    if (Object.keys(parsedPatch).length > 0) {
      update[pk] = parsedPatch;
    }
  }

  const insert = patch.insert.map((entry) =>
    parseDraftRow(entry.cells, table),
  );

  return {
    insert,
    update,
    delete: [...patch.delete],
  };
}
