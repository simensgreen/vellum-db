import type { RowDraft } from "../row-editor.ts";

export type StagingInsert = {
  localId: string;
  cells: RowDraft;
};

/** UI staging patch — string cell values until commit. */
export type StagingPatch = {
  insert: StagingInsert[];
  update: Record<string, RowDraft>;
  delete: string[];
};

/** Commit body shape (matches POST /rows/commit). */
export type CommitPatch = {
  insert: Array<Record<string, unknown>>;
  update: Record<string, Record<string, unknown>>;
  delete: string[];
};

export function emptyPatch(): StagingPatch {
  return {
    insert: [],
    update: {},
    delete: [],
  };
}

export function clonePatch(patch: StagingPatch): StagingPatch {
  return {
    insert: patch.insert.map((entry) => ({
      localId: entry.localId,
      cells: { ...entry.cells },
    })),
    update: Object.fromEntries(
      Object.entries(patch.update).map(([pk, rowDraft]) => [pk, { ...rowDraft }]),
    ),
    delete: [...patch.delete],
  };
}

export type { RowDraft as PhantomRow };
