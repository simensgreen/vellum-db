import { describe, expect, test } from "bun:test";
import type { TableSummary } from "../apps/tables/src/api.ts";
import {
  defaultInsertDraft,
  draftDiffersFromDefault,
  emptyInsertDraft,
} from "../apps/tables/src/row-editor.ts";
import {
  setCellUpdate,
  promotePhantomToInsert,
} from "../apps/tables/src/staging/patch-ops.ts";
import { emptyPatch } from "../apps/tables/src/staging/types.ts";
import { patchToCommitBody } from "../apps/tables/src/staging/to-commit.ts";

const eventsTableSummary: TableSummary = {
  name: "events",
  scope: null,
  definition: {
    slug: "events",
    name: "Events",
    columns: [
      {
        name: "Event ID",
        slug: "event_id",
        primaryKey: true,
        data: { type: "nanoid", default: "random" },
      },
      {
        name: "Title",
        slug: "title",
        data: { type: "str", minLen: 1 },
      },
      {
        name: "Created",
        slug: "created_at",
        data: { type: "timestamp", default: "now" },
      },
    ],
  },
  columns: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const tasksColumns = eventsTableSummary.definition.columns.filter(
  (column) => column.slug !== "event_id",
);

describe("insert draft defaults", () => {
  test("timestamp now default stays empty and stable", () => {
    const first = defaultInsertDraft(eventsTableSummary);
    const second = defaultInsertDraft(eventsTableSummary);

    expect(first.created_at).toBe("");
    expect(second.created_at).toBe("");
    expect(first).toEqual(second);
  });

  test("unchanged empty insert draft does not count as pending", () => {
    const draft = emptyInsertDraft(eventsTableSummary);
    expect(draftDiffersFromDefault(draft, eventsTableSummary)).toBe(false);
  });
});

describe("table staging patch", () => {
  test("reverts update when cell matches original", () => {
    const original = { title: "Hello", created_at: "2026-01-01T00:00:00.000Z" };
    let patch = emptyPatch();
    patch = setCellUpdate(patch, "row-1", "title", "Changed", original, tasksColumns);
    expect(patch.update["row-1"]?.title).toBe("Changed");

    patch = setCellUpdate(patch, "row-1", "title", "Hello", original, tasksColumns);
    expect(patch.update["row-1"]).toBeUndefined();
  });

  test("promotes phantom into insert list", () => {
    const phantom = defaultInsertDraft(eventsTableSummary);
    phantom.title = "New event";
    const { patch, insert } = promotePhantomToInsert(emptyPatch(), phantom);
    expect(patch.insert).toHaveLength(1);
    expect(insert.cells.title).toBe("New event");
  });

  test("toCommitBody maps update keys to parsed patch", () => {
    const original = { title: "Hello", created_at: "2026-01-01T00:00:00.000Z" };
    const patch = setCellUpdate(
      emptyPatch(),
      "row-1",
      "title",
      "Changed",
      original,
      tasksColumns,
    );
    const body = patchToCommitBody(
      patch,
      eventsTableSummary,
      new Map([["row-1", original]]),
      tasksColumns,
    );
    expect(body.update["row-1"]).toEqual({ title: "Changed" });
  });
});
