import { describe, expect, test } from "bun:test";
import {
  invalidationTagsForCatalogChange,
  invalidationTagsForRowMutation,
  invalidationTagsForSavedQueriesChange,
  invalidationTagsForRawSqlMutation,
  subscribeTagsForRowView,
  subscribeTagsForTableList,
  SYNC_TAGS,
  tableDataTag,
  tableNameFromDataTag,
} from "../src/core/sync-tags.ts";

describe("sync-tags", () => {
  test("tableDataTag and tableNameFromDataTag round-trip", () => {
    expect(tableDataTag("expenses")).toBe("vellum-db:table:expenses");
    expect(tableNameFromDataTag("vellum-db:table:expenses")).toBe("expenses");
    expect(tableNameFromDataTag("vellum-db:tables")).toBeNull();
  });

  test("invalidation tag batches", () => {
    expect(invalidationTagsForCatalogChange("tasks")).toEqual([
      SYNC_TAGS.tables,
      "vellum-db:table:tasks",
    ]);
    expect(invalidationTagsForRowMutation("tasks")).toEqual([
      "vellum-db:table:tasks",
    ]);
    expect(invalidationTagsForSavedQueriesChange()).toEqual([
      SYNC_TAGS.savedQueries,
    ]);
    expect(invalidationTagsForRawSqlMutation()).toEqual([SYNC_TAGS.tables]);
  });

  test("subscribe tag batches", () => {
    expect(subscribeTagsForTableList()).toEqual([SYNC_TAGS.tables]);
    expect(subscribeTagsForRowView("tasks")).toEqual([
      SYNC_TAGS.tables,
      "vellum-db:table:tasks",
    ]);
  });
});
