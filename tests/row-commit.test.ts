import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUserTable, ensureMetaSchema } from "../src/core/catalog.ts";
import { commitRowChanges } from "../src/core/row-commit.ts";
import { insertRow } from "../src/core/rows.ts";
import { executeQueryDefinition } from "../src/core/query.ts";
import {
  closeDatabase,
  getDatabase,
  openDatabase,
  parseConfig,
} from "../src/db.ts";
import { tasksDefinition, itemsDefinition } from "./fixtures/table-definitions.ts";
import { POST as commitRowsRoute } from "../routes/rows/commit.ts";

function withTempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "vellum-db-row-commit-"));
  openDatabase(
    dir,
    parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only" }),
  );
  ensureMetaSchema();
  createUserTable(tasksDefinition);
  return dir;
}

afterEach(() => {
  closeDatabase();
});

describe("commitRowChanges", () => {
  test("applies updates inserts and deletes in one transaction", () => {
    const dir = withTempDb();
    try {
      const keepInsert = insertRow({
        table: "tasks",
        row: { title: "Keep", status: "open", points: 1 },
      });
      const removeInsert = insertRow({
        table: "tasks",
        row: { title: "Remove", status: "open", points: 2 },
      });
      const keepId = keepInsert.id;
      const removeId = removeInsert.id;

      const result = commitRowChanges({
        table: "tasks",
        update: {
          [keepId]: { status: "done", points: 5 },
        },
        insert: [{ title: "New task", status: "open", points: 3 }],
        delete: [removeId],
      });

      expect(result).toEqual({
        table: "tasks",
        updated: 1,
        inserted: 1,
        deleted: 1,
      });

      const rowsAfter = executeQueryDefinition({ table: "tasks", limit: 10 });
      expect(rowsAfter.total_count).toBe(2);
      expect(rowsAfter.rows.some((row) => row.title === "Remove")).toBe(false);
      expect(rowsAfter.rows.some((row) => row.title === "New task")).toBe(true);
      const kept = rowsAfter.rows.find((row) => row.task_id === keepId);
      expect(kept?.status).toBe("done");
      expect(kept?.points).toBe(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("updates boolean columns without schema validation errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "vellum-db-row-commit-bool-"));
    openDatabase(
      dir,
      parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only" }),
    );
    ensureMetaSchema();
    createUserTable(itemsDefinition);
    try {
      const inserted = insertRow({
        table: "items",
        row: { title: "Widget", points: 1, active: false },
      });

      const result = commitRowChanges({
        table: "items",
        update: {
          [inserted.id]: { active: true },
        },
      });

      expect(result.updated).toBe(1);

      const rowsAfter = executeQueryDefinition({ table: "items", limit: 10 });
      const updated = rowsAfter.rows.find((row) => row.item_id === inserted.id);
      expect(updated?.active).toBe(true);
    } finally {
      closeDatabase();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rolls back all changes when validation fails", () => {
    const dir = withTempDb();
    try {
      const inserted = insertRow({
        table: "tasks",
        row: { title: "Original", status: "open", points: 1 },
      });

      expect(() =>
        commitRowChanges({
          table: "tasks",
          update: {
            [inserted.id]: { status: "done" },
          },
          insert: [{ title: "", status: "open", points: 1 }],
        }),
      ).toThrow();

      const rowsAfter = executeQueryDefinition({ table: "tasks", limit: 10 });
      expect(rowsAfter.total_count).toBe(1);
      expect(rowsAfter.rows[0]?.title).toBe("Original");
      expect(rowsAfter.rows[0]?.status).toBe("open");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects empty commit body", () => {
    const dir = withTempDb();
    try {
      expect(() =>
        commitRowChanges({
          table: "tasks",
        }),
      ).toThrow("commit requires at least one change");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("POST /rows/commit route", () => {
  test("returns commit result JSON", async () => {
    const dir = withTempDb();
    try {
      const inserted = insertRow({
        table: "tasks",
        row: { title: "Route test", status: "open", points: 1 },
      });

      const response = await commitRowsRoute(
        new Request("http://local/rows/commit?table=tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            update: {
              [inserted.id]: { status: "done" },
            },
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        table: string;
        updated: number;
      };
      expect(body.table).toBe("tasks");
      expect(body.updated).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
