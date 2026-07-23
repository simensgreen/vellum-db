import type { TableDefinition } from "../src/core/table/types.ts";
import { createUserTable, getTable } from "../src/core/catalog.ts";
import { getDatabase } from "../src/db.ts";
import { insertRow } from "../src/core/rows.ts";
import {
  measureLiveSnapshot,
  type StatsSnapshot,
} from "../src/core/stats-store.ts";
import { addUtcEpochDays, utcEpochDay } from "../src/utc-epoch-day.ts";

const HISTORY_DAYS = 29;

const eventsDefinition: TableDefinition = {
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
};

const notesDefinition: TableDefinition = {
  slug: "notes",
  name: "Notes",
  columns: [
    {
      name: "Note ID",
      slug: "note_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Body",
      slug: "body",
      data: { type: "str" },
    },
    {
      name: "Updated",
      slug: "updated_at",
      data: { type: "timestamp", default: "now" },
    },
  ],
};

const typeShowcaseDefinition: TableDefinition = {
  slug: "type_showcase",
  name: "Type Showcase",
  description: "Dev sample with one column per field type",
  columns: [
    {
      name: "Row ID",
      slug: "row_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Label",
      slug: "label",
      data: { type: "str", minLen: 1 },
    },
    {
      name: "Count",
      slug: "count",
      data: { type: "int", min: 0, max: 100 },
    },
    {
      name: "Score",
      slug: "score",
      data: { type: "float", min: 0, max: 1 },
    },
    {
      name: "Active",
      slug: "active",
      data: { type: "bool", default: false },
    },
    {
      name: "Status",
      slug: "status",
      data: {
        type: "enum",
        variants: ["draft", "live", "archived"],
        default: 0,
      },
    },
    {
      name: "Created",
      slug: "created_at",
      data: { type: "timestamp", default: "now" },
    },
    {
      name: "Meta",
      slug: "meta",
      data: { type: "json" },
    },
    {
      name: "Event Ref",
      slug: "event_ref",
      data: { type: "ref", table: "events", column: "event_id" },
    },
  ],
};

function tableRowCount(tableName: string): number {
  const database = getDatabase();
  const row = database
    .query(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get() as { count: number };
  return row.count;
}

function opsForDay(dayIndex: number): {
  inserts: number;
  updates: number;
  deletions: number;
  reads: number;
} {
  const progress = dayIndex / HISTORY_DAYS;
  const wave = Math.sin(dayIndex * 0.45);
  const ripple = Math.cos(dayIndex * 0.25);
  return {
    inserts: Math.max(2, Math.floor(5 + wave * 4 + progress * 8)),
    updates: Math.max(1, Math.floor(2 + ripple * 3 + progress * 5)),
    deletions: Math.max(0, Math.floor(1 + Math.abs(ripple) * 2)),
    reads: Math.max(5, Math.floor(12 + wave * 10 + progress * 20)),
  };
}

function snapshotForDay(
  dayIndex: number,
  target: StatsSnapshot,
): StatsSnapshot {
  const progress = dayIndex / HISTORY_DAYS;
  const wave = Math.sin(dayIndex * 0.45);

  const rowFloor = Math.max(1, Math.floor(target.row_count * 0.35));
  const rowCount = Math.max(
    rowFloor,
    Math.floor(rowFloor + (target.row_count - rowFloor) * progress + wave * 2),
  );

  const tableFloor = Math.max(1, target.table_count - 1);
  const tableCount = Math.max(
    1,
    Math.min(
      target.table_count,
      Math.floor(tableFloor + (target.table_count - tableFloor) * progress),
    ),
  );

  const bytesFloor = Math.max(4096, Math.floor(target.database_bytes * 0.4));
  const databaseBytes = Math.max(
    bytesFloor,
    Math.floor(
      bytesFloor + (target.database_bytes - bytesFloor) * progress + wave * 512,
    ),
  );

  return {
    table_count: tableCount,
    row_count: rowCount,
    database_bytes: databaseBytes,
  };
}

function seedHistoricalStats(today: number, target: StatsSnapshot): void {
  const database = getDatabase();
  for (let dayIndex = 0; dayIndex <= HISTORY_DAYS; dayIndex += 1) {
    const day = addUtcEpochDays(today, dayIndex - HISTORY_DAYS);
    const ops = opsForDay(dayIndex);
    const snapshot =
      dayIndex === HISTORY_DAYS ? target : snapshotForDay(dayIndex, target);
    database
      .query(
        `INSERT OR REPLACE INTO _stats (
          day, table_count, row_count, database_bytes,
          inserts, updates, deletions, reads
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        day,
        snapshot.table_count,
        snapshot.row_count,
        snapshot.database_bytes,
        ops.inserts,
        ops.updates,
        ops.deletions,
        ops.reads,
      );
  }
}

function seedTypeShowcaseIfEmpty(): void {
  if (!getTable("type_showcase")) {
    createUserTable(typeShowcaseDefinition);
  }
  if (tableRowCount("type_showcase") > 0) {
    return;
  }

  const database = getDatabase();
  const firstEvent = database
    .query("SELECT event_id FROM events LIMIT 1")
    .get() as { event_id: string } | null;

  const sampleRow: Record<string, unknown> = {
    label: "All types demo",
    count: 42,
    score: 0.75,
    active: true,
    status: "live",
    meta: { tags: ["demo", "dev"], version: 1 },
  };
  if (firstEvent) {
    sampleRow.event_ref = firstEvent.event_id;
  }

  insertRow({ table: "type_showcase", row: sampleRow });
}

function seedSampleTables(): void {
  if (!getTable("events")) {
    createUserTable(eventsDefinition);
  }
  if (!getTable("notes")) {
    createUserTable(notesDefinition);
  }

  if (tableRowCount("events") === 0) {
    const eventTitles = [
      "Deploy release",
      "User signup",
      "Import batch",
      "Weekly report",
      "Cache warmup",
      "Schema migration",
      "Alert resolved",
      "Backup complete",
    ];
    for (const title of eventTitles) {
      insertRow({ table: "events", row: { title } });
    }
  }

  if (tableRowCount("notes") === 0) {
    const noteBodies = [
      "Remember to rotate keys",
      "Dashboard looks good",
      "Check retention policy",
      "Add index on created_at",
    ];
    for (const body of noteBodies) {
      insertRow({ table: "notes", row: { body } });
    }
  }

  seedTypeShowcaseIfEmpty();
}

/** Dev-only sample catalog + 30-day _stats history for chart preview. Idempotent. */
export function seedDevDashboardData(): void {
  seedSampleTables();
  const today = utcEpochDay();
  const liveSnapshot = measureLiveSnapshot();
  seedHistoricalStats(today, liveSnapshot);
}
