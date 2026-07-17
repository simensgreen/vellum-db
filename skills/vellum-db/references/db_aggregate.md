# db_aggregate

Compute metrics (`count`, `sum`, `avg`, `min`, `max`) with optional `group_by`, row `filter`, and post-group `having`. Pagination via `limit`/`offset` (`has_more`).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table name |
| `metrics` | yes | Non-empty array of `{ fn, column?, as }` |
| `group_by` | no | Column names |
| `filter` | no | JSON filter (WHERE) |
| `having` | no | JSON filter on metric aliases (HAVING) |
| `limit` | no | Capped by `maxRowsPerQuery` |
| `offset` | no | Default `0` |

`count` may omit `column` (counts rows). Other metrics require `column`. `as` is the result alias (`[a-z][a-z0-9_]*`).

## Output

`{ table, count, limit, offset, has_more, rows }` — each row is a group (or a single rollup if no `group_by`).

## Examples

**Example excerpt** — count per status:

```json
{
  "table": "tasks",
  "metrics": [{ "fn": "count", "as": "task_count" }],
  "group_by": ["status"]
}
```

**Example excerpt** — sum and avg with filter and having:

```json
{
  "table": "tasks",
  "metrics": [
    { "fn": "sum", "column": "points", "as": "total_points" },
    { "fn": "avg", "column": "points", "as": "avg_points" }
  ],
  "group_by": ["status"],
  "filter": { "status": { "ne": "archived" } },
  "having": { "total_points": { "gte": 5 } },
  "limit": 10,
  "offset": 0
}
```

**Example excerpt** — single-row rollup (no group_by):

```json
{
  "table": "tasks",
  "metrics": [
    { "fn": "count", "as": "total" },
    { "fn": "max", "column": "points", "as": "max_points" }
  ],
  "filter": { "status": "open" }
}
```

Filter JSON shapes match `db_query` (plain equality, operators, `and`/`or`). Prefer saving repeated aggregates with `db_save_query`.
