---
name: vellum-db-meta
description: >-
  Create table, alter table, drop table, JSON Schema, schema design, column
  mapping for vellum-db. Triggers: new table, table schema, add column, drop
  column, db_create_table, db_alter_table, db_drop_table, db_list_tables.
metadata:
  vellum:
    display-name: Vellum DB Meta
    activation-hints:
      - "User asks to create or define a structured table"
      - "User asks to add or remove columns from an existing table"
      - "User asks to drop a table or inspect table schemas"
    avoid-when:
      - "User wants to query, aggregate, or analyze existing rows"
      - "User wants insert, update, delete, or saved queries"
    category: data
    related_skills:
      - vellum-db
---

# Vellum DB Meta (table / schema management)

Manage structured tables in the vellum-db plugin: discover schemas, create from JSON Schema, evolve columns, drop when allowed. For row CRUD, queries, aggregates, and saved queries, load **`vellum-db`** instead.

## When to Use

Load this skill when the user needs to:

- List existing tables and their JSON Schema / columns (`db_list_tables`)
- Create a new table from a JSON Schema (`db_create_table`)
- Add or drop columns on an existing table (`db_alter_table`)
- Drop a registered table (`db_drop_table`, config-gated)

## Do not use for

- Querying, filtering, or aggregating rows — load **`vellum-db`**
- Insert, update, delete row data — load **`vellum-db`**
- Saved queries or ad-hoc SQL for analysis — load **`vellum-db`**
- One-off calculations with no schema change

## Overview

vellum-db stores agent tables with a JSON Schema catalog and SQLite backing. Each user table gets an auto `id TEXT PRIMARY KEY` (nanoid string); you define other columns via JSON Schema `properties`. Table and column names must match `[a-z][a-z0-9_]*`. User table names must not start with `_` (reserved for meta tables). Schema tools are JSON-first; do not use raw SQL for create/alter/drop when these tools apply.

## Workflow

1. **List** — Call `db_list_tables` with optional `scope`, `name_prefix`, `limit`, `offset`. Read `name`, `scope`, `schema`, `columns`, and timestamps before creating or changing anything.
2. **Create** — Call `db_create_table` with `name`, `schema` (`type: "object"`, `properties`, optional `required`), and optional `scope` (`[a-z][a-z0-9_]*`). At least one property required. Do not define `id` in the schema.
3. **Alter** — Call `db_alter_table` with `table` and at least one of `add`, `drop`, or `scope`. Adding columns is lower risk; dropping columns rebuilds the table and is irreversible data loss for removed fields. Cannot rename columns or change types in place. `scope: null` clears the label.
4. **Drop** — Call `db_drop_table` with `table` only when `config.allowDropTable` is `true`. Default is `false`; the tool rejects otherwise. Destroys all rows and the catalog entry.

After schema changes, use **`vellum-db`** for row operations against the updated shape.

## Tool choice

| Goal | Tool | Risk |
| --- | --- | --- |
| Discover schemas / columns | `db_list_tables` | low |
| New table from JSON Schema | `db_create_table` | medium |
| Add or drop columns | `db_alter_table` | high |
| Remove table entirely | `db_drop_table` | high |

**`config.allowDropTable`:** When `false` (default), `db_drop_table` fails with a clear error. Enable only when the host operator accepts destructive schema operations. Dropping does not require a separate confirmation tool — treat the config flag as the gate.

## JSON Schema → column mapping

| JSON Schema `type` | SQLite column | Notes |
| --- | --- | --- |
| `string` | TEXT | Default for unknown types |
| `integer` | INTEGER | |
| `number` | REAL | |
| `boolean` | INTEGER | Stored as 0/1 |
| `object`, `array` | TEXT | JSON-encoded at rest (`jsonStored: true`) |

Rules:

- Table schema must be `type: "object"` with non-empty `properties`.
- Property names in `required` become `NOT NULL` columns at create time.
- Columns added via `db_alter_table` are nullable unless you later recreate the table (type/rename not supported).
- Union types (`type: ["string", "null"]`) use the first listed type for SQL mapping.
- Do not put `id` in `properties`; it is reserved and added automatically.

Longer schema patterns: [references/schema-examples.md](references/schema-examples.md).

## Examples

### Example 1 — Create a tasks table

**Input** (`db_create_table`):

```json
{
  "name": "tasks",
  "scope": "demo",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "status": { "type": "string", "enum": ["open", "done"] },
      "priority": { "type": "integer", "minimum": 1 }
    },
    "required": ["title", "status"]
  }
}
```

**Output** (shape):

```json
{
  "name": "tasks",
  "scope": "demo",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "status": { "type": "string", "enum": ["open", "done"] },
      "priority": { "type": "integer", "minimum": 1 }
    },
    "required": ["title", "status"]
  },
  "columns": ["title", "status", "priority"],
  "created_at": "2026-07-16T12:00:00.000Z"
}
```

(`id` is a nanoid string in SQLite but is not listed in `columns`; it is always present on rows.)

### Example 2 — Add a column

**Input** (`db_alter_table`):

```json
{
  "table": "tasks",
  "add": [
    {
      "name": "due_date",
      "schema": { "type": "string", "format": "date" }
    }
  ]
}
```

**Output** (shape):

```json
{
  "name": "tasks",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "status": { "type": "string", "enum": ["open", "done"] },
      "priority": { "type": "integer", "minimum": 1 },
      "due_date": { "type": "string", "format": "date" }
    },
    "required": ["title", "status"]
  },
  "columns": ["title", "status", "priority", "due_date"],
  "updated_at": "2026-07-16T12:05:00.000Z"
}
```

## Pitfalls

- **Reserved names** — Table names starting with `_` and column name `id` are rejected.
- **Invalid identifiers** — Uppercase, hyphens, or leading digits fail `[a-z][a-z0-9_]*`.
- **Empty schema** — `properties` must have at least one field besides auto `id`.
- **Alter limits** — No rename, no in-place type change; add a new column and migrate data manually if needed.
- **Drop column** — Rebuilds the table; dropped column data is lost permanently.
- **Drop table gated** — Expect failure when `allowDropTable` is false; do not retry without config change.
- **Wrong skill** — Row queries belong in **`vellum-db`**, not here.

## Verification

- [ ] Called `db_list_tables` before create to avoid duplicate names
- [ ] Table `name` and property names match `[a-z][a-z0-9_]*` and no leading `_` on tables
- [ ] Schema is `type: "object"` with at least one property; no `id` in properties
- [ ] After create/alter, `db_list_tables` shows expected `columns` and `schema`
- [ ] For drop: confirmed `config.allowDropTable` is `true` and user intent is explicit
- [ ] Row work delegated to **`vellum-db`** after schema is settled
