import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureMetaSchema } from "../src/core/catalog.ts";
import { insertRow } from "../src/core/rows.ts";
import { getDatabaseStats } from "../src/core/stats.ts";
import {
  getStatsRowForDay,
  listStatsRows,
  measureLiveSnapshot,
  pruneStatsRetention,
  recordStatsDelta,
  refreshStatsSnapshot,
} from "../src/core/stats-store.ts";
import {
  closeDatabase,
  getDatabase,
  openDatabase,
  parseConfig,
} from "../src/db.ts";
import {
  addUtcEpochDays,
  utcEpochDay,
  utcEpochDayToIso,
} from "../src/utc-epoch-day.ts";
import { tasksDefinition } from "./fixtures/table-definitions.ts";
import { GET as statsRoute } from "../routes/stats.ts";
import { POST as createTableRoute } from "../routes/tables.ts";
import { GET as queryRows } from "../routes/rows.ts";

function withTempDb(config: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "vellum-db-stats-"));
  openDatabase(
    dir,
    parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only", ...config }),
  );
  ensureMetaSchema();
  return dir;
}

afterEach(() => {
  closeDatabase();
});

describe("utc epoch day", () => {
  test("round-trips through ISO date", () => {
    const day = utcEpochDay(new Date("2026-07-22T15:30:00Z"));
    expect(utcEpochDayToIso(day)).toBe("2026-07-22");
  });
});

describe("stats store", () => {
  test("ensureMetaSchema creates _stats", () => {
    const dir = withTempDb();
    try {
      expect(getDatabaseStats().summary.table_count).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("parseConfig defaults statsRetentionDays to 30", () => {
    const config = parseConfig({});
    expect(config.statsRetentionDays).toBe(30);
  });

  test("parseConfig accepts statsRetentionDays override", () => {
    const config = parseConfig({ statsRetentionDays: 7 });
    expect(config.statsRetentionDays).toBe(7);
  });

  test("recordStatsDelta tracks inserts and reads", async () => {
    const dir = withTempDb();
    try {
      const createResponse = await createTableRoute(
        new Request("http://local/tables?scope=demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tasksDefinition),
        }),
      );
      expect(createResponse.status).toBe(200);

      insertRow({
        table: "tasks",
        row: { title: "Test", status: "open", points: 1 },
      });

      await queryRows(
        new Request("http://local/rows?table=tasks&limit=10&offset=0"),
      );

      const today = utcEpochDay();
      const row = getStatsRowForDay(today);
      expect(row).not.toBeNull();
      expect(row!.inserts).toBe(1);
      expect(row!.reads).toBeGreaterThanOrEqual(1);
      expect(row!.table_count).toBe(1);
      expect(row!.row_count).toBe(1);
      expect(row!.database_bytes).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("pruneStatsRetention removes rows older than retention window", () => {
    const dir = withTempDb({ statsRetentionDays: 7 });
    try {
      refreshStatsSnapshot();
      const oldDay = addUtcEpochDays(utcEpochDay(), -10);
      getDatabase()
        .query(
          `INSERT INTO _stats (
            day, table_count, row_count, database_bytes,
            inserts, updates, deletions, reads
          ) VALUES (?, 0, 0, 0, 1, 0, 0, 0)
          ON CONFLICT(day) DO UPDATE SET inserts = 1`,
        )
        .run(oldDay);

      expect(listStatsRows(oldDay, oldDay)).toHaveLength(1);
      pruneStatsRetention();
      expect(listStatsRows(oldDay, oldDay)).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("getDatabaseStats", () => {
  test("returns buckets with operations and snapshots", async () => {
    const dir = withTempDb();
    try {
      await createTableRoute(
        new Request("http://local/tables?scope=demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tasksDefinition),
        }),
      );
      refreshStatsSnapshot();
      recordStatsDelta({ inserts: 2, reads: 5 });

      const stats = getDatabaseStats({ granularity: "day" });
      expect(stats.retention_days).toBe(30);
      expect(stats.summary.table_count).toBe(1);
      expect(stats.buckets.length).toBeGreaterThan(0);
      const lastBucket = stats.buckets[stats.buckets.length - 1]!;
      expect(lastBucket.inserts).toBeGreaterThanOrEqual(2);
      expect(lastBucket.reads).toBeGreaterThanOrEqual(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("week granularity aggregates operation totals", () => {
    const dir = withTempDb();
    try {
      refreshStatsSnapshot();
      recordStatsDelta({ updates: 3 });

      const stats = getDatabaseStats({ granularity: "week", limit: 2 });
      expect(stats.granularity).toBe("week");
      expect(stats.buckets.length).toBeGreaterThan(0);
      const totalUpdates = stats.buckets.reduce(
        (sum, bucket) => sum + bucket.updates,
        0,
      );
      expect(totalUpdates).toBeGreaterThanOrEqual(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("GET /stats route", () => {
  test("returns database stats JSON", async () => {
    const dir = withTempDb();
    try {
      const response = await statsRoute(
        new Request("http://local/stats?granularity=day"),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        summary: { table_count: number };
        buckets: unknown[];
      };
      expect(body.summary.table_count).toBe(0);
      expect(Array.isArray(body.buckets)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("measureLiveSnapshot", () => {
  test("reflects created table metadata", async () => {
    const dir = withTempDb();
    try {
      await createTableRoute(
        new Request("http://local/tables?scope=demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tasksDefinition),
        }),
      );
      const snapshot = measureLiveSnapshot();
      expect(snapshot.table_count).toBe(1);
      expect(snapshot.database_bytes).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
