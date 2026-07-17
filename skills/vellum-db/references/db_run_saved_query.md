# db_run_saved_query

Execute a previously saved query or aggregate. Bind every `$placeholder` via `params`.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Saved query name |
| `params` | no | Map of placeholder name → value |

Missing params leave the literal `"$name"` string and usually fail validation.

## Output

`{ name, kind, result }` where `result` matches `db_query` or `db_aggregate` output (including pagination fields when applicable).

## Examples

**Example excerpt** — run query for done status:

```json
{
  "name": "open_tasks",
  "params": { "status": "done" }
}
```

**Example excerpt** — run aggregate with two placeholders:

```json
{
  "name": "points_by_status_since",
  "params": {
    "status": "open",
    "min_points": 2
  }
}
```

Save definitions with `db_save_query`.
