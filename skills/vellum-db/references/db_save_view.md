# db_save_view

Persist a named query or aggregate view for later runs. Upserts by `slug`. Use `"$param"` string placeholders inside the definition for runtime binding.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | `[a-z][a-z0-9_]*` |
| `name` | yes | Human-readable display name |
| `kind` | yes | `query` \| `aggregate` |
| `definition` | yes | Same shape as `db_query` or `db_aggregate` input |
| `description` | no | Human/agent summary |
| `scope` | no | Optional grouping scope `[a-z][a-z0-9_]*` |

## Output

Saved view metadata (`slug`, `name`, `kind`, `scope`, timestamps, etc.).

## Examples

**Example excerpt** — save a parameterized query:

```json
{
  "slug": "open_tasks",
  "name": "Open tasks",
  "kind": "query",
  "scope": "work",
  "description": "Tasks filtered by status, newest points first",
  "definition": {
    "table": "tasks",
    "filter": { "status": "$status" },
    "order": [{ "column": "points", "direction": "desc" }]
  }
}
```

Run with `db_run_view`. Definition field shapes match `db_query` or `db_aggregate` tool input. Join/filter/limit matrix: [view-query-model.md](view-query-model.md).
