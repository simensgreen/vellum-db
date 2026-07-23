import type { TableDefinition } from "../src/core/table/types.ts";
import { createUserTable, getTable } from "../src/core/catalog.ts";
import { getDatabase } from "../src/db.ts";
import { insertRow } from "../src/core/rows.ts";
import { getView, saveView } from "../src/core/views.ts";
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

const regionsDefinition: TableDefinition = {
  slug: "regions",
  name: "Regions",
  columns: [
    {
      name: "Region ID",
      slug: "region_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Name",
      slug: "name",
      data: { type: "str", minLen: 1 },
    },
  ],
};

const projectsDefinition: TableDefinition = {
  slug: "projects",
  name: "Projects",
  columns: [
    {
      name: "Project ID",
      slug: "project_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Name",
      slug: "name",
      data: { type: "str", minLen: 1 },
    },
    {
      name: "Status",
      slug: "status",
      data: {
        type: "enum",
        variants: ["active", "paused", "done"],
        default: 0,
      },
    },
    {
      name: "Region",
      slug: "region_ref",
      data: { type: "ref", table: "regions", column: "region_id" },
    },
  ],
};

const tasksDefinition: TableDefinition = {
  slug: "tasks",
  name: "Tasks",
  columns: [
    {
      name: "Task ID",
      slug: "task_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Title",
      slug: "title",
      data: { type: "str", minLen: 1 },
    },
    {
      name: "Status",
      slug: "status",
      data: {
        type: "enum",
        variants: ["open", "in_progress", "done"],
        default: 0,
      },
    },
    {
      name: "Points",
      slug: "points",
      data: { type: "int", min: 0, max: 13 },
    },
    {
      name: "Project",
      slug: "project_ref",
      data: { type: "ref", table: "projects", column: "project_id" },
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

function seedWorkTables(): void {
  if (!getTable("regions")) {
    createUserTable(regionsDefinition, { scope: "work" });
  }
  if (!getTable("projects")) {
    createUserTable(projectsDefinition, { scope: "work" });
  }
  if (!getTable("tasks")) {
    createUserTable(tasksDefinition, { scope: "work" });
  }

  const database = getDatabase();

  if (tableRowCount("regions") === 0) {
    for (const name of ["Europe", "Americas", "Asia Pacific"]) {
      insertRow({ table: "regions", row: { name } });
    }
  }

  if (tableRowCount("projects") === 0) {
    const regions = database
      .query("SELECT region_id, name FROM regions ORDER BY name")
      .all() as Array<{ region_id: string; name: string }>;
    const regionByName = new Map(
      regions.map((region) => [region.name, region.region_id]),
    );
    const europeId = regionByName.get("Europe");
    const americasId = regionByName.get("Americas");

    for (const row of [
      { name: "Website relaunch", status: "active", region_ref: europeId },
      { name: "Mobile app", status: "active", region_ref: europeId },
      { name: "Data pipeline", status: "active", region_ref: americasId },
      { name: "Legacy API", status: "paused", region_ref: europeId },
    ]) {
      insertRow({ table: "projects", row });
    }
  }

  if (tableRowCount("tasks") === 0) {
    const projects = database
      .query("SELECT project_id, name FROM projects ORDER BY name")
      .all() as Array<{ project_id: string; name: string }>;

    const projectByName = new Map(
      projects.map((project) => [project.name, project.project_id]),
    );
    const websiteId = projectByName.get("Website relaunch");
    const mobileId = projectByName.get("Mobile app");
    const pipelineId = projectByName.get("Data pipeline");

    const taskRows: Array<Record<string, unknown>> = [
      {
        title: "Design landing page",
        status: "done",
        points: 5,
        project_ref: websiteId,
      },
      {
        title: "Implement auth flow",
        status: "in_progress",
        points: 8,
        project_ref: websiteId,
      },
      {
        title: "Push notifications",
        status: "open",
        points: 3,
        project_ref: mobileId,
      },
      {
        title: "Offline sync",
        status: "open",
        points: 8,
        project_ref: mobileId,
      },
      {
        title: "ETL job scheduler",
        status: "in_progress",
        points: 5,
        project_ref: pipelineId,
      },
      {
        title: "Schema validation",
        status: "open",
        points: 2,
        project_ref: pipelineId,
      },
    ];

    for (const row of taskRows) {
      if (row.project_ref) {
        insertRow({ table: "tasks", row });
      }
    }
  }
}

function seedSampleViews(): void {
  if (!getView("tasks_by_status")) {
    saveView({
      slug: "tasks_by_status",
      name: "Tasks by status",
      kind: "query",
      scope: "work",
      description: "Tasks filtered by status, highest points first",
      definition: {
        table: "tasks",
        filter: { status: "$status" },
        order: [{ column: "points", direction: "desc" }],
      },
    });
  }

  if (!getView("tasks_filtered")) {
    saveView({
      slug: "tasks_filtered",
      name: "Tasks filtered",
      kind: "query",
      scope: "work",
      description: "Tasks by status with a minimum points threshold",
      definition: {
        table: "tasks",
        filter: {
          status: "$status",
          points: { gte: "$min_points" },
        },
        order: [{ column: "points", direction: "desc" }],
      },
    });
  }

  if (!getView("points_by_status")) {
    saveView({
      slug: "points_by_status",
      name: "Points by status",
      kind: "aggregate",
      scope: "work",
      description: "Sum of story points grouped by task status",
      definition: {
        table: "tasks",
        metrics: [{ fn: "sum", column: "points", as: "total_points" }],
        group_by: ["status"],
      },
    });
  }

  if (!getView("tasks_with_project")) {
    saveView({
      slug: "tasks_with_project",
      name: "Tasks with project",
      kind: "query",
      scope: "work",
      description: "Tasks joined to project name",
      definition: {
        table: "tasks",
        joins: [
          {
            ref: "project_ref",
            select: { name: "project_name" },
          },
        ],
        columns: ["task_id", "title", "status", "points", "project_name"],
        order: [{ column: "project_name", direction: "asc" }],
      },
    });
  }

  if (!getView("tasks_with_project_inner")) {
    saveView({
      slug: "tasks_with_project_inner",
      name: "Tasks with project (inner)",
      kind: "query",
      scope: "work",
      description: "Only tasks that have a linked project",
      definition: {
        table: "tasks",
        joins: [
          {
            ref: "project_ref",
            type: "inner",
            select: { name: "project_name" },
          },
        ],
        columns: ["task_id", "title", "status", "points", "project_name"],
      },
    });
  }

  if (!getView("orphan_projects")) {
    saveView({
      slug: "orphan_projects",
      name: "Projects including orphans",
      kind: "query",
      scope: "work",
      description: "RIGHT join: projects without tasks appear with null task fields",
      definition: {
        table: "tasks",
        joins: [
          {
            ref: "project_ref",
            type: "right",
            select: {
              name: "project_name",
              project_id: "project_id",
            },
          },
        ],
        columns: ["title", "project_name", "project_id"],
        order: [{ column: "project_name", direction: "asc" }],
      },
    });
  }

  if (!getView("tasks_with_region")) {
    saveView({
      slug: "tasks_with_region",
      name: "Tasks with region",
      kind: "query",
      scope: "work",
      description: "Multi-hop join: tasks → projects → regions",
      definition: {
        table: "tasks",
        joins: [
          { ref: "project_ref", select: { name: "project_name" } },
          {
            source: "projects",
            ref: "region_ref",
            select: { name: "region_name" },
          },
        ],
        columns: ["title", "status", "points", "project_name", "region_name"],
        order: [{ column: "region_name", direction: "asc" }],
      },
    });
  }

  if (!getView("points_by_project")) {
    saveView({
      slug: "points_by_project",
      name: "Points by project",
      kind: "aggregate",
      scope: "work",
      description: "Aggregate with join, filter, having, and limit",
      definition: {
        table: "tasks",
        joins: [
          {
            ref: "project_ref",
            type: "inner",
            select: { name: "project_name" },
          },
        ],
        metrics: [
          { fn: "count", as: "task_count" },
          { fn: "sum", column: "points", as: "total_points" },
        ],
        group_by: ["project_name"],
        filter: { status: { ne: "done" } },
        having: { total_points: { gte: 3 } },
        limit: 10,
      },
    });
  }

  if (!getView("top_projects_by_points")) {
    saveView({
      slug: "top_projects_by_points",
      name: "Top projects by points",
      kind: "aggregate",
      scope: "work",
      description: "Joined aggregate ordered by total points",
      definition: {
        table: "tasks",
        joins: [{ ref: "project_ref", select: { name: "project_name" } }],
        metrics: [{ fn: "sum", column: "points", as: "total_points" }],
        group_by: ["project_name"],
        order: [{ column: "total_points", direction: "desc" }],
        limit: 5,
      },
    });
  }

  if (!getView("recent_events")) {
    saveView({
      slug: "recent_events",
      name: "Recent events",
      kind: "query",
      description: "Latest events (no params)",
      definition: {
        table: "events",
        order: [{ column: "created_at", direction: "desc" }],
        limit: 10,
      },
    });
  }
}

function seedSampleTables(): void {
  if (!getTable("events")) {
    createUserTable(eventsDefinition, { scope: "analytics" });
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
  seedWorkTables();
}

/** Dev-only sample catalog + 30-day _stats history for chart preview. Idempotent. */
export function seedDevDashboardData(): void {
  seedSampleTables();
  seedSampleViews();
  const today = utcEpochDay();
  const liveSnapshot = measureLiveSnapshot();
  seedHistoricalStats(today, liveSnapshot);
}
