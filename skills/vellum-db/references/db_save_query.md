# db_save_query

Persist a named query or aggregate definition for later runs. Upserts by `name`. Use `"$param"` string placeholders inside the definition for runtime binding.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | `[a-z][a-z0-9_]*` |
| `kind` | yes | `query` \| `aggregate` |
| `definition` | yes | Same shape as `db_query` or `db_aggregate` input |
| `description` | no | Human/agent summary |

## Output

Saved row metadata (`name`, `kind`, timestamps, etc.).

## Examples

**Example excerpt** — save a parameterized query:

```json
{
  "name": "open_tasks",
  "kind": "query",
  "description": "Tasks filtered by status, newest points first",
  "definition": {
    "table": "tasks",
    "filter": { "status": "$status" },
    "order": [{ "column": "points", "direction": "desc" }]
  }
}
```

**Example excerpt** — save an aggregate with multiple params:

```json
{
  "name": "points_by_status_since",
  "kind": "aggregate",
  "description": "Sum points per status for rows above a minimum",
  "definition": {
    "table": "tasks",
    "metrics": [{ "fn": "sum", "column": "points", "as": "total" }],
    "group_by": ["status"],
    "filter": {
      "status": "$status",
      "points": { "gte": "$min_points" }
    }
  }
}
```

Run with `db_run_saved_query`. Definition field shapes match `db_query` or `db_aggregate` tool input.
