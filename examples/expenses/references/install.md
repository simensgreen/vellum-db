# Install and activate

First-time setup for the expense tracker skill. The skill ships under `examples/expenses/` in the vellum-db plugin repo and is **not** auto-indexed by Vellum until copied into the workspace skills tree.

## Prerequisites

1. **vellum-db plugin** installed in the Vellum workspace (`assistant plugins install`).
2. Run **`bun install`** inside the plugin directory after install or upgrade:

**Example excerpt:**

```bash
cd plugins/vellum-db && bun install
```

The host does not install plugin runtime deps (`ajv`, `@truto/sqlite-builder`, `nanoid`, `xlsx`) automatically.

## Copy the skill

Copy or symlink the example into the workspace skills directory:

**Example excerpt:**

```bash
cp -R plugins/vellum-db/examples/expenses <workspace>/skills/expenses
```

Replace `<workspace>` with your Vellum workspace root. The skill `name` in frontmatter is `expenses`; the directory basename should match.

## Load order

On each session that uses expense tracking:

1. `skill_load { "skill": "expenses" }` — domain procedures (this skill).
2. If tables are missing: `skill_load { "skill": "vellum-db-meta" }` — bootstrap DDL (`db_create_table`).
3. For row ops and views: `skill_load { "skill": "vellum-db" }` — `db_insert`, `db_query`, `db_run_view`, etc.

Bootstrap steps and schema file index: [schema.md](schema.md). JSON payloads: [../schemas/](../schemas/).

## Verify

After bootstrap:

- `db_list_tables` with `scope: "expenses"` returns `category` and `expenses`.
- `db_list_views` with `scope: "expenses"` returns `expenses_with_category` and `spending_by_category`.
- `db_query` on `category` returns seeded rows (26 default categories).
