---
name: vellum-db
description: >-
  Query and analyze structured data with JSON filters, aggregates, and named
  views. Triggers: db_query, db_aggregate, filter JSON, view,
  db_run_view, db_sql, db_load, db_dump, import csv, export xlsx,
  list tables, count rows, group by.
metadata:
  vellum:
    display-name: Vellum DB Query
    activation-hints:
      - "User asks to query or filter rows in a structured table"
      - "User asks to aggregate, count, sum, or group stored data"
      - "User asks to save, run, or list a named view"
      - "User asks to import or export table data (csv, json, jsonl, xlsx)"
      - "User needs raw SQL only when JSON tools cannot express the need"
    avoid-when:
      - "User wants to create, alter, or drop tables — load vellum-db-meta instead"
      - "User only needs unstructured notes or chat memory"
      - "User wants a one-off calculation with no persistence or table access"
    category: data
    related_skills:
      - vellum-db-meta
---

# Vellum DB — Query and Analyze

Load with `skill_load` and `{ "skill": "vellum-db" }`. Prefer JSON tools over SQL. Do not invent SQL for routine reads or analysis.

## When to Use

- Discover tables and columns before querying.
- Filter, sort, and page rows with `db_query`.
- Compute metrics with `db_aggregate` (count, sum, avg, min, max; optional `group_by`, `having`).
- Insert, update, or delete rows when preparing or cleaning data for analysis.
- Save repeated analysis as named views with `$param` placeholders (views are created in migration files via **`vellum-db-meta`**).
- Run `db_sql` only when JSON tools cannot express the need.

## Do not use for

- **Create, alter, or drop tables / views** — load **`vellum-db-meta`** and apply migration files (`db_migrate`).
- One-off math with no table access.
- Unstructured notes or chat memory outside vellum-db tables.

## Overview

The vellum-db plugin stores agent data in **TableDefinition** tables (column slugs, explicit primary keys). This skill covers **reading and analyzing** that data: list tables, query rows with JSON filters, aggregate metrics, manage views, and use `db_sql` as a last resort. Row writes (`db_insert`, `db_update`, `db_delete`) are included when they support analysis workflows (seed sample data, fix bad rows, prune stale records). Results respect `config.maxRowsPerQuery`. Raw SQL behavior follows `config.rawSqlMode` (`select-only`, `on`, or `off`). Row objects use column **slugs** as keys; primary keys are declared on columns (often `nanoid` with `default: "random"`), not an implicit `id`.

## Workflow

1. **Discover** — call `db_list_tables` (optional `scope`, `slug_prefix`, `limit`, `offset`). Read `slug`, `scope`, `definition`, and `columns` (slugs) before querying. Details: [references/db_list_tables.md](references/db_list_tables.md).
2. **Choose read tool** — `db_query` for row-level reads; `db_aggregate` for metrics and `group_by`. Both support `limit`/`offset` and return `page_count`, `total_count`, and `has_more`. Details: [references/db_query.md](references/db_query.md), [references/db_aggregate.md](references/db_aggregate.md).
3. **Prepare data if needed** — `db_insert` to add rows; `db_update` / `db_delete` with a **non-empty** JSON `filter`. Details: [references/db_insert.md](references/db_insert.md), [references/db_update.md](references/db_update.md), [references/db_delete.md](references/db_delete.md).
4. **Repeat analysis** — run saved views with `db_run_view` and `params`. Views are defined in domain `migrate.up.json` files (see **`vellum-db-meta`**). Details: [references/db_run_view.md](references/db_run_view.md).
5. **List views** — [references/db_list_views.md](references/db_list_views.md).
6. **Import / export** — [references/db_load.md](references/db_load.md), [references/db_dump.md](references/db_dump.md). Relative `path` is under the Vellum workspace.
7. **Raw SQL last** — [references/db_sql.md](references/db_sql.md). Single statement only. Prefer saved JSON views for anything you will run again.

## Tool choice

| Goal | Tool | Reference |
| --- | --- | --- |
| See tables and schemas | `db_list_tables` | [references/db_list_tables.md](references/db_list_tables.md) |
| Read matching rows | `db_query` | [references/db_query.md](references/db_query.md) |
| Metrics / rollups | `db_aggregate` | [references/db_aggregate.md](references/db_aggregate.md) |
| Add a row | `db_insert` | [references/db_insert.md](references/db_insert.md) |
| Patch matched rows | `db_update` | [references/db_update.md](references/db_update.md) |
| Remove matched rows | `db_delete` | [references/db_delete.md](references/db_delete.md) |
| Run a saved view | `db_run_view` | [references/db_run_view.md](references/db_run_view.md) |
| Inspect views | `db_list_views` | [references/db_list_views.md](references/db_list_views.md) |
| Import rows from a file | `db_load` | [references/db_load.md](references/db_load.md) |
| Export all rows to a file | `db_dump` | [references/db_dump.md](references/db_dump.md) |
| Escape hatch | `db_sql` | [references/db_sql.md](references/db_sql.md) |

## Views

**Why save:** repeated dashboards, parameterized reports, and stable names agents can reuse without re-sending full filter JSON. Views are authored in domain **`migrate.up.json`** files and applied with **`db_migrate`** (see **`vellum-db-meta`**).

**Parameters:** string placeholders like `"$status"` inside the definition; bind with `params` on `db_run_view`. See [references/db_run_view.md](references/db_run_view.md).

**Manage:** [references/db_list_views.md](references/db_list_views.md). Schema changes to views go through migration files.

## Filters (JSON, not SQL)

Equality is a plain value: `{ "status": "open" }`. Comparisons use operators: `{ "points": { "gte": 2 } }`. Combine with `and` / `or`. Full filter examples: [references/db_query.md](references/db_query.md).

## Raw SQL (`db_sql`)

| `config.rawSqlMode` | Behavior |
| --- | --- |
| `select-only` | SELECT / WITH only; tool rejects writes |
| `on` | Any single statement allowed |
| `off` | `db_sql` disabled |

Never pass multiple statements (no semicolons). Details and examples: [references/db_sql.md](references/db_sql.md).

## Examples

### Example 1

**Input (user):** "Show open tasks sorted by points, highest first."

**Output (tool call):**

```json
{
  "table": "tasks",
  "filter": { "status": "open" },
  "order": [{ "column": "points", "direction": "desc" }]
}
```

Call `db_query` with the JSON above. Expect `{ "table", "page_count", "total_count", "limit", "offset", "has_more", "rows" }` where each row is keyed by column slug (including primary key column(s)). More shapes: [references/db_query.md](references/db_query.md).

### Example 2

**Input (user):** "Run the saved tasks-by-status view for done items."

**Output (tool call):**

```json
{
  "slug": "tasks_by_status",
  "params": { "status": "done" }
}
```

(View must exist from a prior domain migration.)

## Common pitfalls

- Querying before `db_list_tables` — column slugs come from `definition` / `columns`, not guesses. Prefer `scope` when many tables exist.
- Ignoring `has_more` — bump `offset` by `limit` and re-query until `has_more` is false (`total_count` shows the full match size).
- Using SQL strings in `db_query` / `db_aggregate` — pass JSON filters only.
- Empty `filter` on `db_update` or `db_delete` — rejected to prevent wiping a whole table.
- Forgetting `params` on `db_run_view` — `"$name"` placeholders stay literal and fail.
- Re-sending the full query JSON on every run — use saved views from domain migrations instead.
- Calling `db_sql` for routine reads — prefer JSON tools; raw SQL is high risk and mode-gated.
- Table DDL (create/alter/drop) — out of scope; load **`vellum-db-meta`**.

## Verification checklist

- [ ] Called `db_list_tables` when schema or table slugs were unknown.
- [ ] Used `db_query` or `db_aggregate` (not `db_sql`) for routine reads.
- [ ] Repeated analysis uses `db_run_view` on views from domain migrations.
- [ ] Every `$placeholder` in a view definition has a matching `params` key at run time.
- [ ] `db_update` / `db_delete` filters are non-empty objects.
- [ ] `db_sql` used only when JSON tools cannot express the need, and only if `rawSqlMode` is not `off`.
- [ ] DDL / view authoring deferred to **`vellum-db-meta`** (`db_migrate`), not handled here.
