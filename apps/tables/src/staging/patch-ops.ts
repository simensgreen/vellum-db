import type { ColumnDefinition } from "vellum-db/core/table/types";
import type { TableSummary } from "../api.ts";
import {
  defaultInsertDraft,
  formatDraftValue,
  rowToDraft,
  validateDraftCell,
  type RowDraft,
} from "../row-editor.ts";
import { clonePatch, type StagingInsert, type StagingPatch } from "./types.ts";

function fieldDraftMatchesBaseline(
  column: ColumnDefinition,
  raw: string,
  baselineValue: unknown,
): boolean {
  const baselineDraft = formatDraftValue(baselineValue, column);
  return raw.trim() === baselineDraft.trim();
}

function boolValueEqual(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): boolean | null => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    if (value === "true" || value === "1") {
      return true;
    }
    if (value === "false" || value === "0") {
      return false;
    }
    return null;
  };
  const leftBool = normalize(left);
  const rightBool = normalize(right);
  if (leftBool !== null && rightBool !== null) {
    return leftBool === rightBool;
  }
  return false;
}

function valuesEqualForColumn(
  column: ColumnDefinition,
  left: unknown,
  right: unknown,
): boolean {
  if (left === right) {
    return true;
  }
  if (column.data.type === "bool") {
    return boolValueEqual(left, right);
  }
  if (left === null || left === undefined) {
    return right === null || right === undefined;
  }
  if (right === null || right === undefined) {
    return false;
  }
  if (column.data.type === "timestamp") {
    const leftTime = new Date(String(left)).getTime();
    const rightTime = new Date(String(right)).getTime();
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return false;
    }
    return leftTime === rightTime;
  }
  if (typeof left === "object" || typeof right === "object") {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

export function diffPatch(
  baseline: Record<string, unknown>,
  draft: RowDraft,
  columns: ColumnDefinition[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const column of columns) {
    const raw = draft[column.slug];
    if (raw === undefined) {
      continue;
    }
    const baselineValue = baseline[column.slug] ?? null;
    if (fieldDraftMatchesBaseline(column, raw, baselineValue)) {
      continue;
    }
    const validation = validateDraftCell(column, raw, { required: false });
    if (!validation.valid) {
      continue;
    }
    const parsed = raw.trim() === "" ? null : validation.parsed;
    if (!valuesEqualForColumn(column, parsed, baselineValue)) {
      patch[column.slug] = parsed;
    }
  }
  return patch;
}

export function mergeRowForDisplay(
  original: Record<string, unknown>,
  rowPatch: RowDraft | undefined,
  columns: ColumnDefinition[],
): RowDraft {
  const draft = rowToDraft(original, columns);
  if (!rowPatch) {
    return draft;
  }
  for (const [slug, value] of Object.entries(rowPatch)) {
    draft[slug] = value;
  }
  return draft;
}

function normalizeUpdateEntry(
  patch: StagingPatch,
  pk: string,
  original: Record<string, unknown>,
  columns: ColumnDefinition[],
): void {
  const rowPatch = patch.update[pk];
  if (!rowPatch) {
    return;
  }

  const mergedDraft = mergeRowForDisplay(original, rowPatch, columns);
  const parsedPatch = diffPatch(original, mergedDraft, columns);
  const nextRowPatch: RowDraft = {};
  for (const slug of Object.keys(parsedPatch)) {
    nextRowPatch[slug] = mergedDraft[slug] ?? "";
  }

  if (Object.keys(nextRowPatch).length === 0) {
    delete patch.update[pk];
  } else {
    patch.update[pk] = nextRowPatch;
  }
}

export function setCellUpdate(
  patch: StagingPatch,
  pk: string,
  slug: string,
  raw: string,
  original: Record<string, unknown>,
  columns: ColumnDefinition[],
): StagingPatch {
  const next = clonePatch(patch);
  next.update[pk] = { ...(next.update[pk] ?? {}), [slug]: raw };
  normalizeUpdateEntry(next, pk, original, columns);
  return next;
}

export function updateInsertCell(
  patch: StagingPatch,
  localId: string,
  slug: string,
  raw: string,
): StagingPatch {
  const next = clonePatch(patch);
  next.insert = next.insert.map((entry) =>
    entry.localId === localId
      ? { ...entry, cells: { ...entry.cells, [slug]: raw } }
      : entry,
  );
  return next;
}

export function removeInsert(
  patch: StagingPatch,
  localId: string,
): StagingPatch {
  const next = clonePatch(patch);
  next.insert = next.insert.filter((entry) => entry.localId !== localId);
  return next;
}

export function toggleDelete(
  patch: StagingPatch,
  pk: string,
  marked: boolean,
): StagingPatch {
  const next = clonePatch(patch);
  const deleteSet = new Set(next.delete);
  if (marked) {
    deleteSet.add(pk);
  } else {
    deleteSet.delete(pk);
  }
  next.delete = [...deleteSet];
  return next;
}

export function toggleSelectAllDeletes(
  patch: StagingPatch,
  pks: string[],
  marked: boolean,
): StagingPatch {
  const next = clonePatch(patch);
  const deleteSet = new Set(next.delete);
  for (const pk of pks) {
    if (marked) {
      deleteSet.add(pk);
    } else {
      deleteSet.delete(pk);
    }
  }
  next.delete = [...deleteSet];
  return next;
}

export function promotePhantomToInsert(
  patch: StagingPatch,
  phantom: RowDraft,
): { patch: StagingPatch; insert: StagingInsert } {
  const next = clonePatch(patch);
  const insert: StagingInsert = {
    localId: crypto.randomUUID(),
    cells: { ...phantom },
  };
  next.insert.unshift(insert);
  return { patch: next, insert };
}

export function emptyPhantom(table: TableSummary): RowDraft {
  return defaultInsertDraft(table);
}

export function dirtySlugsForRow(
  original: Record<string, unknown>,
  rowPatch: RowDraft | undefined,
  columns: ColumnDefinition[],
): Set<string> {
  if (!rowPatch) {
    return new Set();
  }
  return new Set(Object.keys(rowPatch));
}

export function isMarkedDelete(patch: StagingPatch, pk: string): boolean {
  return patch.delete.includes(pk);
}

export function countChanges(
  patch: StagingPatch,
  phantomDirty: boolean,
): number {
  let count = patch.insert.length + patch.delete.length;
  if (phantomDirty) {
    count += 1;
  }
  count += Object.keys(patch.update).length;
  return count;
}

export function isEmptyPatch(patch: StagingPatch, phantomDirty: boolean): boolean {
  return countChanges(patch, phantomDirty) === 0;
}
