import { afterEach, describe, expect, test } from "bun:test";
import "../src/openapi/zod.ts";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureMetaSchema,
  getTable,
  listTables,
} from "../src/core/catalog.ts";
import {
  applyMigration,
  listMigrationsView,
  parseMigrationFile,
} from "../src/core/migrate.ts";
import { listMigrations } from "../src/core/migrations-store.ts";
import {
  closeDatabase,
  openDatabase,
  parseConfig,
} from "../src/db.ts";
import { GET as listMigrationsRoute } from "../routes/migrations.ts";
import { POST as migrateRoute } from "../routes/migrate.ts";
import { POST as createTableRoute } from "../routes/tables.ts";
import { tasksDefinition } from "./fixtures/table-definitions.ts";
import { TEST_TABLE_SCOPE } from "./fixtures/test-scope.ts";

const FIXTURES = join(import.meta.dir, "fixtures");

function withTempDb(): { dir: string; workspace: string } {
  const dir = mkdtempSync(join(tmpdir(), "vellum-db-migrate-"));
  const workspace = mkdtempSync(join(tmpdir(), "vellum-db-workspace-"));
  openDatabase(
    dir,
    parseConfig({
      maxRowsPerQuery: 100,
      rawSqlMode: "select-only",
      allowDropTable: true,
    }),
    { workspaceDir: workspace },
  );
  ensureMetaSchema();
  return { dir, workspace };
}

function copyFixture(workspace: string, filename: string): string {
  const relativePath = join("migrations", filename);
  const destination = join(workspace, relativePath);
  mkdirSync(join(workspace, "migrations"), { recursive: true });
  copyFileSync(join(FIXTURES, filename), destination);
  return relativePath;
}

afterEach(() => {
  closeDatabase();
});

describe("migrate", () => {
  test("parseMigrationFile rejects empty migration", () => {
    expect(() =>
      parseMigrationFile({
        version: 1,
      }),
    ).toThrow();
  });

  test("apply up file creates table, seeds rows, records migration", () => {
    const { dir, workspace } = withTempDb();
    try {
      const path = copyFixture(workspace, "migrate-up.json");
      const first = applyMigration({ path });
      expect(first.outcome).toBe("applied");
      expect(first.name).toBe("migrate-up.json");
      expect(first.operations.some((op) => op.kind === "create")).toBe(true);

      expect(getTable("migrate_items")).not.toBeNull();
      const tables = listTables().tables;
      expect(tables.some((table) => table.name === "migrate_items")).toBe(true);

      const second = applyMigration({ path });
      expect(second.outcome).toBe("already_applied");
      expect(second.id).toBe(first.id);

      const history = listMigrations();
      expect(history.count).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("apply down file drops table and records second migration", () => {
    const { dir, workspace } = withTempDb();
    try {
      const upPath = copyFixture(workspace, "migrate-up.json");
      const downPath = copyFixture(workspace, "migrate-down.json");
      applyMigration({ path: upPath });
      const down = applyMigration({ path: downPath });
      expect(down.outcome).toBe("applied");
      expect(getTable("migrate_items")).toBeNull();

      const history = listMigrations();
      expect(history.count).toBe(2);
      expect(history.migrations[0]!.name).toBe("migrate-down.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("hash and id selectors return already_applied", () => {
    const { dir, workspace } = withTempDb();
    try {
      const path = copyFixture(workspace, "migrate-up.json");
      const applied = applyMigration({ path });
      const byHash = applyMigration({ hash: applied.hash });
      expect(byHash.outcome).toBe("already_applied");
      const byId = applyMigration({ id: applied.id });
      expect(byId.outcome).toBe("already_applied");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("listMigrationsView paginates", () => {
    const { dir, workspace } = withTempDb();
    try {
      const upPath = copyFixture(workspace, "migrate-up.json");
      const downPath = copyFixture(workspace, "migrate-down.json");
      applyMigration({ path: upPath });
      applyMigration({ path: downPath });

      const page = listMigrationsView({ limit: 1, offset: 0 });
      expect(page.migrations).toHaveLength(1);
      expect(page.has_more).toBe(true);
      expect(page.count).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("POST /tables records migration via schema gateway", async () => {
    const { dir } = withTempDb();
    try {
      const response = await createTableRoute(
        new Request(`http://local/tables?scope=${TEST_TABLE_SCOPE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tasksDefinition),
        }),
      );
      expect(response.status).toBe(200);

      const history = listMigrations();
      expect(history.count).toBe(1);
      expect(history.migrations[0]!.name.startsWith("api:create:tasks:")).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("REST migrate and list routes", async () => {
    const { dir, workspace } = withTempDb();
    try {
      const path = copyFixture(workspace, "migrate-up.json");
      const applyResponse = await migrateRoute(
        new Request("http://local/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        }),
      );
      expect(applyResponse.status).toBe(200);
      const applyBody = (await applyResponse.json()) as { outcome: string };
      expect(applyBody.outcome).toBe("applied");

      const listResponse = await listMigrationsRoute(
        new Request("http://local/migrations?limit=10&offset=0"),
      );
      expect(listResponse.status).toBe(200);
      const listBody = (await listResponse.json()) as {
        count: number;
        migrations: unknown[];
      };
      expect(listBody.count).toBe(1);
      expect(listBody.migrations).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
