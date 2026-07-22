import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  alterUserTable,
  createUserTable,
  dropUserTable,
  ensureMetaSchema,
  getTableColumns,
  listTables,
} from "../src/core/catalog.ts";
import {
  closeDatabase,
  getDatabase,
  getDatabasePath,
  openDatabase,
  parseConfig,
  resolveWorkspaceDir,
} from "../src/db.ts";
import { compileSelectQuery } from "../src/core/query-compile.ts";
import {
  deleteSavedQuery,
  listSavedQueries,
  saveQuery,
  substituteParams,
} from "../src/core/saved-queries.ts";
import { guardRawSql } from "../src/sql-guard.ts";
import { validateRowAgainstSchema } from "../src/schema-validate.ts";
import { dumpTableToFile, loadTableFromFile } from "../src/core/table-io.ts";
import { insertTableRow } from "../src/core/insert.ts";
import { executeAggregateDefinition } from "../src/core/aggregate.ts";
import { executeQueryDefinition } from "../src/core/query.ts";

function withTempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "vellum-db-"));
  openDatabase(dir, parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only" }));
  ensureMetaSchema();
  return dir;
}

afterEach(() => {
  closeDatabase();
});

describe("vellum-db core", () => {
  test("create insert query aggregate saved query", () => {
    const dir = withTempDb();
    try {
      createUserTable("tasks", {
        type: "object",
        properties: {
          title: { type: "string" },
          status: { type: "string" },
          points: { type: "integer" },
        },
        required: ["title", "status", "points"],
      });

      expect(listTables().tables.map((table) => table.name)).toEqual(["tasks"]);

      const table = listTables().tables[0]!;
      const columns = getTableColumns(table);
      validateRowAgainstSchema(table.name, table.schema_json, {
        title: "Ship plugin",
        status: "open",
        points: 3,
      });

      for (const row of [
        { title: "Ship plugin", status: "open", points: 3 },
        { title: "Write docs", status: "open", points: 2 },
        { title: "Done item", status: "done", points: 1 },
      ]) {
        insertTableRow(table, row);
      }

      const queried = executeQueryDefinition({
        table: "tasks",
        filter: { status: "open" },
        order: [{ column: "points", direction: "desc" }],
      });
      expect(queried.count).toBe(2);
      expect(queried.rows[0]?.title).toBe("Ship plugin");

      const aggregated = executeAggregateDefinition({
        table: "tasks",
        metrics: [{ fn: "sum", column: "points", as: "total" }],
        group_by: ["status"],
      });
      expect(aggregated.count).toBe(2);

      saveQuery({
        name: "open_tasks",
        kind: "query",
        definition: {
          table: "tasks",
          filter: { status: "$status" },
        },
        description: "Tasks by status",
      });
      expect(listSavedQueries().queries).toHaveLength(1);
      const bound = substituteParams(
        { table: "tasks", filter: { status: "$status" } },
        { status: "done" },
      );
      expect(bound).toEqual({
        table: "tasks",
        filter: { status: "done" },
      });
      deleteSavedQuery("open_tasks");
      expect(listSavedQueries().queries).toHaveLength(0);

      alterUserTable({
        table: "tasks",
        add: [{ name: "owner", schema: { type: "string" } }],
      });
      expect(
        getTableColumns(listTables().tables[0]!).map((column) => column.name),
      ).toContain("owner");

      expect(guardRawSql("SELECT 1")).toEqual({
        sql: "SELECT 1",
        isSelect: true,
      });
      expect(() => guardRawSql("DELETE FROM tasks")).toThrow();
      expect(() => compileSelectQuery({ table: "missing" })).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rawSqlMode on allows non-select", () => {
    const dir = mkdtempSync(join(tmpdir(), "vellum-db-"));
    try {
      openDatabase(
        dir,
        parseConfig({
          maxRowsPerQuery: 100,
          rawSqlMode: "on",
          databasePath: null,
        }),
      );
      ensureMetaSchema();
      expect(guardRawSql("DELETE FROM _tables WHERE 0")).toEqual({
        sql: "DELETE FROM _tables WHERE 0",
        isSelect: false,
      });
    } finally {
      closeDatabase();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("databasePath relative under storage dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "vellum-db-"));
    try {
      openDatabase(
        dir,
        parseConfig({
          maxRowsPerQuery: 100,
          rawSqlMode: "select-only",
          databasePath: "custom/store.sqlite",
        }),
      );
      ensureMetaSchema();
      const databasePath = getDatabasePath();
      expect(databasePath.endsWith(join("custom", "store.sqlite"))).toBe(true);
      expect(existsSync(databasePath)).toBe(true);
    } finally {
      closeDatabase();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("db_drop_table gated by allowDropTable", () => {
    const dir = mkdtempSync(join(tmpdir(), "vellum-db-"));
    try {
      openDatabase(
        dir,
        parseConfig({
          maxRowsPerQuery: 100,
          rawSqlMode: "select-only",
          allowDropTable: false,
        }),
      );
      ensureMetaSchema();
      createUserTable("scratch", {
        type: "object",
        properties: { note: { type: "string" } },
        required: ["note"],
      });
      expect(() => dropUserTable("scratch")).toThrow(/allowDropTable/);
      closeDatabase();

      openDatabase(
        dir,
        parseConfig({
          maxRowsPerQuery: 100,
          rawSqlMode: "select-only",
          allowDropTable: true,
        }),
      );
      expect(dropUserTable("scratch")).toEqual({ name: "scratch" });
      expect(listTables().tables).toHaveLength(0);
    } finally {
      closeDatabase();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scope filter and list pagination", () => {
    const dir = withTempDb();
    try {
      const alpha = createUserTable(
        "alpha_tasks",
        {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
        { scope: "project_a" },
      );
      createUserTable(
        "beta_notes",
        {
          type: "object",
          properties: { body: { type: "string" } },
          required: ["body"],
        },
        { scope: "project_b" },
      );
      createUserTable("orphan", {
        type: "object",
        properties: { note: { type: "string" } },
        required: ["note"],
      });

      expect(
        listTables({ scope: "project_a" }).tables.map((table) => table.name),
      ).toEqual(["alpha_tasks"]);
      expect(
        listTables({ scope: null }).tables.map((table) => table.name),
      ).toEqual(["orphan"]);
      expect(
        listTables({ name_prefix: "alpha" }).tables.map((table) => table.name),
      ).toEqual(["alpha_tasks"]);

      const page = listTables({ limit: 1, offset: 0 });
      expect(page.tables).toHaveLength(1);
      expect(page.has_more).toBe(true);
      expect(page.limit).toBe(1);

      alterUserTable({ table: "orphan", scope: "project_a" });
      expect(
        listTables({ scope: "project_a" }).tables.map((table) => table.name),
      ).toEqual(["alpha_tasks", "orphan"]);

      for (let index = 0; index < 5; index += 1) {
        insertTableRow(alpha, { title: `task-${index}` });
      }
      const queried = executeQueryDefinition({
        table: "alpha_tasks",
        limit: 2,
        offset: 0,
        order: [{ column: "id", direction: "asc" }],
      });
      expect(queried.count).toBe(2);
      expect(queried.has_more).toBe(true);
      expect(queried.limit).toBe(2);
      expect(queried.offset).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("db_dump and db_load round-trip json csv jsonl xls", () => {
    const dir = withTempDb();
    try {
      createUserTable("items", {
        type: "object",
        properties: {
          title: { type: "string" },
          points: { type: "integer" },
          active: { type: "boolean" },
        },
        required: ["title", "points", "active"],
      });
      const itemsTable = listTables().tables.find(
        (entry) => entry.name === "items",
      )!;
      for (const row of [
        { title: "one", points: 1, active: true },
        { title: "two", points: 2, active: false },
      ]) {
        insertTableRow(itemsTable, row);
      }

      const jsonPath = join(dir, "items.json");
      expect(
        dumpTableToFile({ table: "items", path: jsonPath, mode: "json" }).count,
      ).toBe(2);
      const dumped = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown[];
      expect(dumped).toHaveLength(2);

      getDatabase().run(`DELETE FROM "items"`);
      expect(
        loadTableFromFile({ table: "items", path: jsonPath, mode: "json" })
          .inserted,
      ).toBe(2);

      const csvPath = join(dir, "items.csv");
      dumpTableToFile({ table: "items", path: csvPath, mode: "csv" });
      getDatabase().run(`DELETE FROM "items"`);
      expect(
        loadTableFromFile({ table: "items", path: csvPath, mode: "csv" })
          .inserted,
      ).toBe(2);

      const jsonlPath = join(dir, "items.jsonl");
      dumpTableToFile({ table: "items", path: jsonlPath, mode: "jsonl" });
      getDatabase().run(`DELETE FROM "items"`);
      expect(
        loadTableFromFile({ table: "items", path: jsonlPath, mode: "jsonl" })
          .inserted,
      ).toBe(2);

      const xlsPath = join(dir, "items.xlsx");
      dumpTableToFile({ table: "items", path: xlsPath, mode: "xls" });
      getDatabase().run(`DELETE FROM "items"`);
      expect(
        loadTableFromFile({ table: "items", path: xlsPath, mode: "xls" })
          .inserted,
      ).toBe(2);

      const count = getDatabase()
        .query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM "items"`)
        .get()!;
      expect(count.count).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("on_conflict ignore and replace by id", () => {
    const dir = withTempDb();
    try {
      const table = createUserTable("items", {
        type: "object",
        properties: {
          title: { type: "string" },
          points: { type: "integer" },
        },
        required: ["title", "points"],
      });
      const first = insertTableRow(table, { title: "one", points: 1 });
      expect(first.outcome).toBe("inserted");
      expect(first.id).toMatch(/^[A-Za-z0-9_-]{21}$/);

      const ignored = insertTableRow(
        table,
        { id: first.id, title: "one-b", points: 9 },
        "ignore",
      );
      expect(ignored.outcome).toBe("ignored");
      expect(ignored.changes).toBe(0);

      const replaced = insertTableRow(
        table,
        { id: first.id, title: "one-c", points: 3 },
        "replace",
      );
      expect(replaced.outcome).toBe("replaced");

      const row = getDatabase()
        .query<{ title: string; points: number }, [string]>(
          `SELECT title, points FROM "items" WHERE id = ?`,
        )
        .get(first.id)!;
      expect(row.title).toBe("one-c");
      expect(row.points).toBe(3);

      expect(() =>
        insertTableRow(table, { id: first.id, title: "fail", points: 1 }, "abort"),
      ).toThrow();

      const exportPath = join(dir, "reload.json");
      dumpTableToFile({ table: "items", path: exportPath, mode: "json" });
      const reload = loadTableFromFile({
        table: "items",
        path: exportPath,
        mode: "json",
        on_conflict: "ignore",
      });
      expect(reload.ignored).toBe(1);
      expect(reload.inserted).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("resolveWorkspaceDir prefers VELLUM_WORKSPACE_DIR", () => {
    const previous = process.env.VELLUM_WORKSPACE_DIR;
    try {
      process.env.VELLUM_WORKSPACE_DIR = "/tmp/vellum-workspace-fixture";
      expect(
        resolveWorkspaceDir("/anything/plugins/vellum-db/data"),
      ).toBe("/tmp/vellum-workspace-fixture");
    } finally {
      if (previous === undefined) {
        delete process.env.VELLUM_WORKSPACE_DIR;
      } else {
        process.env.VELLUM_WORKSPACE_DIR = previous;
      }
    }
  });
});
