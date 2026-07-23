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
  deleteView,
  extractViewParamNames,
  listViews,
  saveView,
  substituteParams,
} from "../src/core/views.ts";
import { guardRawSql } from "../src/sql-guard.ts";
import { validateRowAgainstSchema } from "../src/schema-validate.ts";
import { dumpTableToFile, ioModeFromFilename, loadTableFromFile } from "../src/core/table-io.ts";
import { insertTableRow } from "../src/core/insert.ts";
import { executeAggregateDefinition } from "../src/core/aggregate.ts";
import { executeQueryDefinition } from "../src/core/query.ts";
import {
  alphaTasksDefinition,
  betaNotesDefinition,
  itemsDefinition,
  orphanDefinition,
  scratchDefinition,
  tasksDefinition,
} from "./fixtures/table-definitions.ts";
import { TEST_TABLE_SCOPE } from "./fixtures/test-scope.ts";

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
  test("create insert query aggregate view", () => {
    const dir = withTempDb();
    try {
      createUserTable(tasksDefinition, { scope: TEST_TABLE_SCOPE });

      expect(listTables().tables.map((table) => table.name)).toEqual(["tasks"]);

      const table = listTables().tables[0]!;
      const columns = getTableColumns(table);
      expect(columns.map((column) => column.name)).toEqual([
        "task_id",
        "title",
        "status",
        "points",
      ]);

      validateRowAgainstSchema(table.name, table.schema_json, {
        task_id: "task-1",
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
      expect(queried.total_count).toBe(2);
      expect(queried.rows[0]?.title).toBe("Ship plugin");

      const paged = executeQueryDefinition({
        table: "tasks",
        limit: 1,
        offset: 0,
      });
      expect(paged.count).toBe(1);
      expect(paged.total_count).toBe(3);
      expect(paged.has_more).toBe(true);

      const aggregated = executeAggregateDefinition({
        table: "tasks",
        metrics: [{ fn: "sum", column: "points", as: "total" }],
        group_by: ["status"],
      });
      expect(aggregated.count).toBe(2);

      saveView({
        slug: "open_tasks",
        name: "Open tasks",
        kind: "query",
        definition: {
          table: "tasks",
          filter: { status: "$status" },
        },
        description: "Tasks by status",
        scope: "work",
      });
      expect(listViews().views).toHaveLength(1);
      expect(listViews({ scope: "work" }).views).toHaveLength(1);
      expect(listViews({ scope: "other" }).views).toHaveLength(0);
      const bound = substituteParams(
        { table: "tasks", filter: { status: "$status" } },
        { status: "done" },
      );
      expect(bound).toEqual({
        table: "tasks",
        filter: { status: "done" },
      });
      deleteView("open_tasks");
      expect(listViews().views).toHaveLength(0);

      alterUserTable({
        table: "tasks",
        add: [
          {
            name: "Owner",
            slug: "owner",
            column: {
              name: "Owner",
              slug: "owner",
              data: { type: "str" },
            },
          },
        ],
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
      createUserTable(scratchDefinition, { scope: TEST_TABLE_SCOPE });
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

  test("createUserTable rejects missing scope", () => {
    const dir = withTempDb();
    try {
      expect(() => createUserTable(tasksDefinition)).toThrow(/scope is required/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scope filter and list pagination", () => {
    const dir = withTempDb();
    try {
      const alpha = createUserTable(alphaTasksDefinition, { scope: "project_a" });
      createUserTable(betaNotesDefinition, { scope: "project_b" });
      createUserTable(orphanDefinition, { scope: "misc" });
      alterUserTable({ table: "orphan", scope: null });

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
        order: [{ column: "task_id", direction: "asc" }],
      });
      expect(queried.count).toBe(2);
      expect(queried.has_more).toBe(true);
      expect(queried.limit).toBe(2);
      expect(queried.offset).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("db_dump and db_load round-trip json csv jsonl xlsx", () => {
    const dir = withTempDb();
    try {
      createUserTable(itemsDefinition, { scope: TEST_TABLE_SCOPE });
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

      const xlsxPath = join(dir, "items.xlsx");
      dumpTableToFile({ table: "items", path: xlsxPath, mode: "xlsx" });
      getDatabase().run(`DELETE FROM "items"`);
      expect(
        loadTableFromFile({ table: "items", path: xlsxPath, mode: "xlsx" })
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

  test("ioModeFromFilename maps supported extensions", () => {
    expect(ioModeFromFilename("export.csv")).toBe("csv");
    expect(ioModeFromFilename("export.JSON")).toBe("json");
    expect(ioModeFromFilename("export.jsonl")).toBe("jsonl");
    expect(ioModeFromFilename("export.xlsx")).toBe("xlsx");
    expect(ioModeFromFilename("legacy.xls")).toBe("xlsx");
    expect(() => ioModeFromFilename("no-extension")).toThrow(
      /Cannot detect format/,
    );
    expect(() => ioModeFromFilename("data.txt")).toThrow(/Unsupported file extension/);
  });

  test("on_conflict ignore and replace by primary key", () => {
    const dir = withTempDb();
    try {
      const table = createUserTable(itemsDefinition, { scope: TEST_TABLE_SCOPE });
      const first = insertTableRow(table, { title: "one", points: 1, active: true });
      expect(first.outcome).toBe("inserted");
      expect(first.id).toMatch(/^[A-Za-z0-9_-]{21}$/);

      const ignored = insertTableRow(
        table,
        { item_id: first.id, title: "one-b", points: 9, active: false },
        "ignore",
      );
      expect(ignored.outcome).toBe("ignored");
      expect(ignored.changes).toBe(0);

      const replaced = insertTableRow(
        table,
        { item_id: first.id, title: "one-c", points: 3, active: true },
        "replace",
      );
      expect(replaced.outcome).toBe("replaced");

      const row = getDatabase()
        .query<{ title: string; points: number }, [string]>(
          `SELECT title, points FROM "items" WHERE item_id = ?`,
        )
        .get(first.id)!;
      expect(row.title).toBe("one-c");
      expect(row.points).toBe(3);

      expect(() =>
        insertTableRow(
          table,
          { item_id: first.id, title: "fail", points: 1, active: true },
          "abort",
        ),
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
