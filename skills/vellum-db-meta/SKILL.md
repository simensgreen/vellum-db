---
name: vellum-db-meta
description: >-
  Author and apply flat schema migration files for vellum-db. Triggers: migration,
  migrate.up.json, migrate.down.json, bootstrap schema, teardown tables,
  db_migrate, db_list_migrations, TableDefinition DSL.
metadata:
  vellum:
    display-name: Vellum DB Meta
    activation-hints:
      - "User asks to create tables, views, or seed data for a new domain"
      - "User asks to bootstrap or tear down a skill schema"
      - "User asks to apply migrate.up.json or migrate.down.json"
      - "User asks to list applied schema migrations"
    avoid-when:
      - "User wants to query, aggregate, or analyze existing rows"
      - "User wants insert, update, delete row data without schema change"
    category: data
    related_skills:
      - vellum-db
---

# Vellum DB Meta (schema migrations)

Load with `skill_load` and `{ "skill": "vellum-db-meta" }`. Schema changes go through **flat migration JSON files** applied with **`db_migrate`**. For row CRUD, queries, aggregates, and running views, load **`vellum-db`** instead.

## When to Use

- Author `migrate.up.json` / `migrate.down.json` for a domain skill
- Bootstrap tables, seed rows, and saved views in one apply
- Tear down a domain schema (views + tables)
- Inspect migration history (`db_list_migrations`)
- Discover existing tables before authoring migrations (`db_list_tables`)

## Do not use for

- Querying or aggregating rows — load **`vellum-db`**
- Insert, update, delete row data — load **`vellum-db`**
- One-off calculations with no schema change

## Overview

Each migration file is a flat JSON document: `{ version: 1, create?, alter?, drop?, seed?, views?, delete_views? }`. Skills ship **two files** per domain. History is stored in **`_migrations`** (hash dedup → `already_applied` on re-run).

Full format: [references/migration-format.md](references/migration-format.md).

## Workflow

1. **Discover** — `db_list_tables` (optional `scope`) to avoid duplicate slugs.
2. **Author** — write `schemas/migrate.up.json` and `schemas/migrate.down.json` in the domain skill directory.
3. **Bootstrap** — `db_migrate { "path": "schemas/migrate.up.json" }` (path relative to skill directory; workspace example: `skills/<skill>/schemas/migrate.up.json`).
4. **Verify** — `db_list_tables` / `db_list_views`; `db_list_migrations` for audit.
5. **Teardown** (when needed) — `db_migrate { "path": "…/migrate.down.json" }` (requires `config.allowDropTable = true` for `drop` sections).
6. **Row work** — load **`vellum-db`** after schema is applied.

## Tool choice

| Goal | Tool | Reference |
| --- | --- | --- |
| Apply migration file | `db_migrate` | [references/db_migrate.md](references/db_migrate.md) |
| List applied migrations | `db_list_migrations` | [references/db_list_migrations.md](references/db_list_migrations.md) |
| Inspect tables | `db_list_tables` | **`vellum-db`** skill |

## TableDefinition DSL (summary)

| `data.type` | SQLite | Notes |
| --- | --- | --- |
| `str` | TEXT | Optional `minLen`, `maxLen`, `pattern`, `unique` |
| `int` | INTEGER | Optional `min`, `max` |
| `float` | REAL | Optional `min`, `max` |
| `bool` | INTEGER (0/1) | **`default` required** |
| `enum` | INTEGER | `variants` array; `default` is index |
| `timestamp` | TEXT (ISO) | Optional `default: "now"` |
| `nanoid` | TEXT | Often PK; `default: "random"` |
| `ref` | TEXT | `table`, `column` (PK on target) |
| `json` | TEXT | JSON-encoded object/array |

Rules: at least one `primaryKey: true` column; table slug `[a-z][a-z0-9_]*` (no leading `_`).

Patterns: [references/schema-examples.md](references/schema-examples.md).

## Example — bootstrap

**File** (`skills/demo/schemas/migrate.up.json`):

```json
{
  "version": 1,
  "create": [
    {
      "scope": "demo",
      "definition": {
        "slug": "tasks",
        "name": "Tasks",
        "columns": [
          {
            "name": "Task ID",
            "slug": "task_id",
            "primaryKey": true,
            "data": { "type": "nanoid", "default": "random" }
          },
          {
            "name": "Title",
            "slug": "title",
            "data": { "type": "str", "minLen": 1 }
          }
        ]
      }
    }
  ]
}
```

**Apply:**

```json
{ "path": "schemas/migrate.up.json" }
```

## Pitfalls

- **Re-bootstrap blocked** — same up file hash → `already_applied`; bump file content for a new hash.
- **Drop gated** — `drop` in migrations needs `allowDropTable = true`.
- **FK order** — create referenced tables before refs; drop dependents before parents in down files.
- **Wrong skill** — row queries belong in **`vellum-db`**.

## Verification

- [ ] `migrate.up.json` and `migrate.down.json` authored; at least one section each
- [ ] `db_migrate` up returns `outcome: "applied"` on fresh DB
- [ ] Re-run up → `already_applied`
- [ ] `db_list_tables` shows expected tables after bootstrap
- [ ] Row work delegated to **`vellum-db`**
