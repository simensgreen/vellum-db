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
- Save repeated analysis as named views with `$param` placeholders.
- Run `db_sql` only when JSON tools cannot express the need.

## Do not use for

- **Create, alter, or drop tables** — load **`vellum-db-meta`** instead (`db_create_table`, `db_alter_table`, `db_drop_table`).
- One-off math with no table access.
- Unstructured notes or chat memory outside vellum-db tables.

## Overview

The vellum-db plugin stores agent data in **TableDefinition** tables (column slugs, explicit primary keys). This skill covers **reading and analyzing** that data: list tables, query rows with JSON filters, aggregate metrics, manage views, and use `db_sql` as a last resort. Row writes (`db_insert`, `db_update`, `db_delete`) are included when they support analysis workflows (seed sample data, fix bad rows, prune stale records). Results respect `config.maxRowsPerQuery`. Raw SQL behavior follows `config.rawSqlMode` (`select-only`, `on`, or `off`). Row objects use column **slugs** as keys; primary keys are declared on columns (often `nanoid` with `default: "random"`), not an implicit `id`.

## Workflow

1. **Discover** — call `db_list_tables` (optional `scope`, `name_prefix`, `limit`, `offset`). Read `name`, `scope`, `definition`, and `columns` (slugs) before querying. Details: [references/db_list_tables.md](references/db_list_tables.md).
2. **Choose read tool** — `db_query` for row-level reads; `db_aggregate` for metrics and `group_by`. Both support `limit`/`offset` and return `has_more`. Details: [references/db_query.md](references/db_query.md), [references/db_aggregate.md](references/db_aggregate.md).
3. **Prepare data if needed** — `db_insert` to add rows; `db_update` / `db_delete` with a **non-empty** JSON `filter`. Details: [references/db_insert.md](references/db_insert.md), [references/db_update.md](references/db_update.md), [references/db_delete.md](references/db_delete.md).
4. **Repeat analysis** — `db_save_view` once, then `db_run_view` with `params`. Details: [references/db_save_view.md](references/db_save_view.md), [references/db_run_view.md](references/db_run_view.md).
5. **List or retire views** — [references/db_list_views.md](references/db_list_views.md), [references/db_delete_view.md](references/db_delete_view.md).
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
| Persist a view | `db_save_view` | [references/db_save_view.md](references/db_save_view.md) |
| Run a view | `db_run_view` | [references/db_run_view.md](references/db_run_view.md) |
| Inspect views | `db_list_views` | [references/db_list_views.md](references/db_list_views.md) |
| Remove a view | `db_delete_view` | [references/db_delete_view.md](references/db_delete_view.md) |
| Import rows from a file | `db_load` | [references/db_load.md](references/db_load.md) |
| Export all rows to a file | `db_dump` | [references/db_dump.md](references/db_dump.md) |
| Escape hatch | `db_sql` | [references/db_sql.md](references/db_sql.md) |

## Views

**Why save:** repeated dashboards, parameterized reports, and stable names agents can reuse without re-sending full filter JSON.

**How to save:** `db_save_view` with stable `slug` + `name`, optional `scope`, `kind` (`query` or `aggregate`), and `definition`. Join/filter/limit matrix: [references/view-query-model.md](references/view-query-model.md). See [references/db_save_view.md](references/db_save_view.md).

**Parameters:** string placeholders like `"$status"` inside the definition; bind with `params` on `db_run_view`. See [references/db_run_view.md](references/db_run_view.md).

**Manage:** [references/db_list_views.md](references/db_list_views.md), [references/db_delete_view.md](references/db_delete_view.md).

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

Call `db_query` with the JSON above. Expect `{ "table", "count", "limit", "offset", "has_more", "rows" }` where each row is keyed by column slug (including primary key column(s)). More shapes: [references/db_query.md](references/db_query.md).

### Example 2

**Input (user):** "Save a query for tasks by status and run it for done items."

**Output (tool calls):**

1. `db_save_view` — see [references/db_save_view.md](references/db_save_view.md):

```json
{
  "name": "tasks_by_status",
  "kind": "query",
  "description": "Tasks filtered by status parameter",
  "definition": {
    "table": "tasks",
    "filter": { "status": "$status" },
    "order": [{ "column": "points", "direction": "desc" }]
  }
}
```

2. `db_run_view` — see [references/db_run_view.md](references/db_run_view.md):

```json
{
  "name": "tasks_by_status",
  "params": { "status": "done" }
}
```

## Common pitfalls

- Querying before `db_list_tables` — column slugs come from `definition` / `columns`, not guesses. Prefer `scope` when many tables exist.
- Ignoring `has_more` — bump `offset` by `limit` and re-query until `has_more` is false.
- Using SQL strings in `db_query` / `db_aggregate` — pass JSON filters only.
- Empty `filter` on `db_update` or `db_delete` — rejected to prevent wiping a whole table.
- Forgetting `params` on `db_run_view` — `"$name"` placeholders stay literal and fail.
- Re-sending the full query JSON on every run — save with `db_save_view` instead.
- Calling `db_sql` for routine reads — prefer JSON tools; raw SQL is high risk and mode-gated.
- Table DDL (create/alter/drop) — out of scope; load **`vellum-db-meta`**.

## Verification checklist

- [ ] Called `db_list_tables` when schema or table names were unknown.
- [ ] Used `db_query` or `db_aggregate` (not `db_sql`) for routine reads.
- [ ] Repeated analysis saved with `db_save_view` and run via `db_run_view`.
- [ ] Every `$placeholder` in a view definition has a matching `params` key at run time.
- [ ] `db_update` / `db_delete` filters are non-empty objects.
- [ ] `db_sql` used only when JSON tools cannot express the need, and only if `rawSqlMode` is not `off`.
- [ ] DDL requests deferred to **`vellum-db-meta`**, not handled here.
