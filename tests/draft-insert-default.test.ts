import { describe, expect, test } from "bun:test";
import type { TableSummary } from "../apps/tables/src/api.ts";
import {
  defaultInsertDraft,
  draftDiffersFromDefault,
  emptyInsertDraft,
} from "../apps/tables/src/row-editor.ts";

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
