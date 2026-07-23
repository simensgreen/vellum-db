# db_run_view

Execute a previously saved view. Bind every `$placeholder` via `params`.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | View slug |
| `params` | no | Map of placeholder name → value |

Missing params leave the literal `"$name"` string and usually fail validation.

## Output

`{ slug, name, kind, result }` where `result` matches `db_query` or `db_aggregate` output (`page_count`, `total_count`, `limit`, `offset`, `has_more`, `rows` when paginated).

## Examples

**Example excerpt** — run query for done status:

```json
{
  "slug": "open_tasks",
  "params": { "status": "done" }
}
```

**Example excerpt** — run with two placeholders:

```json
{
  "slug": "tasks_filtered",
  "params": {
    "status": "open",
    "min_points": 2
  }
}
```

Views are defined in domain migration files (`vellum-db-meta`).
