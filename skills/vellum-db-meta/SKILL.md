---
name: vellum-db-meta
description: >-
  Create table, alter table, drop table, TableDefinition DSL, schema design,
  column mapping for vellum-db. Triggers: new table, table schema, add column,
  drop column, db_create_table, db_alter_table, db_drop_table, db_list_tables.
metadata:
  vellum:
    display-name: Vellum DB Meta
    activation-hints:
      - "User asks to create and define a structured table"
      - "User asks to add or remove columns from an existing table"
      - "User asks to drop a table or inspect table definitions"
    avoid-when:
      - "User wants to query, aggregate, or analyze existing rows"
      - "User wants insert, update, delete, or saved queries"
    category: data
    related_skills:
      - vellum-db
---

# Vellum DB Meta (table / schema management)

Manage structured tables in the vellum-db plugin: discover definitions, create from **TableDefinition DSL**, evolve columns, drop when allowed. For row CRUD, queries, aggregates, and saved queries, load **`vellum-db`** instead.

## When to Use

- List existing tables and their **TableDefinition** / columns (`db_list_tables`)
- Create a new table from a **TableDefinition** object (`db_create_table`)
- Add or drop columns on an existing table (`db_alter_table`)
- Drop a registered table (`db_drop_table`, config-gated)

## Do not use for

- Querying, filtering, or aggregating rows — load **`vellum-db`**
- Insert, update, delete row data — load **`vellum-db`**
- Saved queries or ad-hoc SQL for analysis — load **`vellum-db`**
- One-off calculations with no schema change

## Overview

vellum-db stores agent tables with a **TableDefinition DSL** catalog and SQLite backing. There is **no implicit `id` column** — declare primary key(s) on columns with `"primaryKey": true` (often a `nanoid` column with `"default": "random"`). Table slug (`definition.slug`) becomes the SQLite table name and must match `[a-z][a-z0-9_]*` and must not start with `_` (reserved for meta). Column slugs use the same pattern. Rows are validated against a compiled JSON Schema derived from the definition.

## Workflow

1. **List** — Call `db_list_tables` with optional `scope`, `name_prefix`, `limit`, `offset`. Read `name`, `scope`, `definition`, `columns` (slugs), and timestamps before creating or changing anything.
2. **Create** — Call `db_create_table` with `definition` (TableDefinition) and optional `scope` (`[a-z][a-z0-9_]*`). At least one column with `primaryKey: true` is required.
3. **Alter** — Call `db_alter_table` with `table` and at least one of `add`, `drop`, or `scope`. Adding columns is lower risk; dropping columns rebuilds the table and is irreversible data loss for removed fields. Cannot rename columns or change types in place. `scope: null` clears the label.
4. **Drop** — Call `db_drop_table` with `table` only when `config.allowDropTable` is `true`. Default is `false`; the tool rejects otherwise. Destroys all rows and the catalog entry.

After schema changes, use **`vellum-db`** for row operations against the updated shape.

## Tool choice

| Goal | Tool | Risk |
| --- | --- | --- |
| Discover definitions / columns | `db_list_tables` | low |
| New table from TableDefinition | `db_create_table` | medium |
| Add or drop columns | `db_alter_table` | high |
| Remove table entirely | `db_drop_table` | high |

**`config.allowDropTable`:** When `false` (default), `db_drop_table` fails with a clear error. Enable only when the host operator accepts destructive schema operations.

## TableDefinition DSL (summary)

| `data.type` | SQLite | Notes |
| --- | --- | --- |
| `str` | TEXT | Optional `minLen`, `maxLen`, `pattern`, `unique` |
| `int` | INTEGER | Optional `min`, `max` |
| `float` | REAL | Optional `min`, `max` |
| `bool` | INTEGER (0/1) | **`default` required** (`true` or `false`) |
| `enum` | INTEGER | `variants` array; `default` is index |
| `timestamp` | TEXT (ISO) | Optional `default: "now"` |
| `nanoid` | TEXT | Often PK; `default: "random"` or fixed `{ "value": "…" }` |
| `ref` | TEXT | `table`, `column` (PK on target), optional `onDelete` / `onUpdate` |
| `json` | TEXT | JSON-encoded object/array |

Rules:

- `definition.slug` — table name; `definition.name` — display label.
- At least one column must have `"primaryKey": true` (composite PK: mark multiple columns).
- `bool` columns must include `default`.
- `ref.column` must reference a primary-key column on the target table.
- Optional column `nullable: true` allows NULL on insert.

Full patterns: [references/schema-examples.md](references/schema-examples.md).

## Examples

### Example 1 — Create a tasks table

**Input** (`db_create_table`):

```json
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
      },
      {
        "name": "Status",
        "slug": "status",
        "data": { "type": "enum", "variants": ["open", "done"], "default": 0 }
      },
      {
        "name": "Points",
        "slug": "points",
        "data": { "type": "int", "min": 0 }
      }
    ]
  }
}
```

**Output** (shape):

```json
{
  "name": "tasks",
  "scope": "demo",
  "definition": { "slug": "tasks", "name": "Tasks", "columns": ["…"] },
  "columns": [
    { "name": "task_id", "sqlType": "TEXT", "notNull": true, "jsonStored": false },
    { "name": "title", "sqlType": "TEXT", "notNull": true, "jsonStored": false },
    { "name": "status", "sqlType": "INTEGER", "notNull": true, "jsonStored": false },
    { "name": "points", "sqlType": "INTEGER", "notNull": true, "jsonStored": false }
  ],
  "created_at": "2026-07-16T12:00:00.000Z"
}
```

(`columns[].name` is the column **slug** used in row objects and filters.)

### Example 2 — Add a column

**Input** (`db_alter_table`):

```json
{
  "table": "tasks",
  "add": [
    {
      "name": "Due date",
      "slug": "due_date",
      "column": {
        "name": "Due date",
        "slug": "due_date",
        "data": { "type": "timestamp" }
      }
    }
  ]
}
```

## Pitfalls

- **Reserved names** — Table slugs starting with `_` are rejected.
- **Missing primary key** — At least one column must have `primaryKey: true`.
- **Bool without default** — Rejected at definition validate time.
- **Alter limits** — No rename, no in-place type change; add a new column and migrate data manually if needed.
- **Drop column** — Rebuilds the table; dropped column data is lost permanently. Cannot drop PK columns.
- **Drop table gated** — Expect failure when `allowDropTable` is false.
- **Wrong skill** — Row queries belong in **`vellum-db`**, not here.
- **Legacy JSON Schema create** — Not supported; use TableDefinition only.

## Verification

- [ ] Called `db_list_tables` before create to avoid duplicate slugs
- [ ] `definition.slug` and column slugs match `[a-z][a-z0-9_]*`; table slug does not start with `_`
- [ ] At least one `primaryKey: true` column; bool columns have defaults
- [ ] After create/alter, `db_list_tables` shows expected `definition` and `columns`
- [ ] For drop: confirmed `config.allowDropTable` is `true` and user intent is explicit
- [ ] Row work delegated to **`vellum-db`** after schema is settled
