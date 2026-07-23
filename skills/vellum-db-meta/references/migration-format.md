# Migration file format

One JSON file = one migration direction. Domain skills ship **two files**:

- `schemas/migrate.up.json` — bootstrap (create, seed, views)
- `schemas/migrate.down.json` — teardown (delete views, drop tables)

No `up`/`down` wrapper inside the file.

## Shape

```json
{
  "version": 1,
  "create": [],
  "alter": [],
  "drop": [],
  "seed": [],
  "views": [],
  "delete_views": []
}
```

At least one section must be non-empty.

## Sections

| Section | Up file | Down file |
| --- | --- | --- |
| `create[]` | TableDefinition payloads with required `scope` | — |
| `alter[]` | Column add/drop / scope changes | Reverse alters (explicit) |
| `drop[]` | Remove legacy tables | Remove domain tables (FK order) |
| `seed[]` | Insert rows (`on_conflict` optional, default `ignore`) | — |
| `views[]` | Save named views | — |
| `delete_views[]` | — | View slugs to remove |

## Compile order (fixed)

`drop` → `create` → `alter` → `seed` → `views` → `delete_views`

Empty sections are skipped.

## create entry

```json
{
  "scope": "demo",
  "definition": {
    "slug": "tasks",
    "name": "Tasks",
    "columns": ["…"]
  }
}
```

## seed entry

```json
{
  "table": "category",
  "on_conflict": "ignore",
  "rows": [{ "name": "Food", "description": "…" }]
}
```

## views entry

```json
{
  "slug": "tasks_by_status",
  "name": "Tasks by status",
  "kind": "query",
  "scope": "demo",
  "definition": {
    "table": "tasks",
    "filter": { "status": "$status" }
  }
}
```

Required fields: `slug`, `name`, `kind`, `scope`, `definition`. Optional: `description`.

## Pitfalls

- Re-bootstrap after teardown: `migrate.up.json` hash blocks re-apply — change file content (new hash) or use a new up file version.
- `drop` requires `allowDropTable` in plugin config.
- Create `category` before `expenses` when using refs.

Example pair: domain skill `schemas/migrate.up.json` + `schemas/migrate.down.json` (see [examples/expenses](../../../examples/expenses/schemas/)).
