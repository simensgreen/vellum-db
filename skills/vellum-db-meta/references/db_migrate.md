# db_migrate

Apply a **flat migration JSON file** (one direction per file). Workspace-relative `path`.

## Input

Provide exactly one selector:

| Field | Type | Meaning |
| --- | --- | --- |
| `path` | string | Workspace-relative path to `migrate.up.json` or `migrate.down.json` |
| `hash` | string | SHA-256 of an already-applied migration (returns `already_applied`) |
| `id` | integer | `_migrations.id` of an applied migration (returns `already_applied`) |

```json
{ "path": "skills/my-domain/schemas/migrate.up.json" }
```

## Output

```json
{
  "outcome": "applied",
  "id": 1,
  "hash": "…",
  "name": "migrate.up.json",
  "operations": [
    { "kind": "create", "target": "tasks", "outcome": "applied" }
  ]
}
```

When the file hash is already recorded:

```json
{
  "outcome": "already_applied",
  "id": 1,
  "hash": "…",
  "name": "migrate.up.json",
  "operations": []
}
```

## Notes

- Dedup is by **file bytes** (SHA-256). Re-running the same file is safe.
- Bootstrap: apply `migrate.up.json`. Teardown: apply `migrate.down.json` (separate file, separate hash).
- `drop` sections require `config.allowDropTable = true`.
- File format: [migration-format.md](migration-format.md).
