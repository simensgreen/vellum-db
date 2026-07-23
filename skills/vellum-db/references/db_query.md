# db_query

Read rows with a JSON filter (not SQL). Supports order, column projection, and `limit`/`offset` pagination (`has_more`).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table name (slug) |
| `filter` | no | JSON filter object (keys = column **slugs**) |
| `order` | no | `[{ "column", "direction": "asc"\|"desc" }]` — `column` is slug |
| `limit` | no | Capped by `maxRowsPerQuery` |
| `offset` | no | Default `0` |
| `columns` | no | Subset of slugs to return (default: all columns) |

## Output

`{ table, count, limit, offset, has_more, rows }`. Each row object is keyed by column slug (including primary key column(s)).

## Filters

Equality is a plain value. Comparisons use operators. Combine with `and` / `or`.

| Shape | Meaning |
| --- | --- |
| `{ "status": 0 }` | Equals (enum stored as index) |
| `{ "points": { "gte": 2 } }` | Comparison (`gt`/`gte`/`lt`/`lte`/`ne`) |
| `{ "status": { "in": [0, 1] } }` | Membership |
| `{ "title": { "like": "%plugin%" } }` | LIKE |
| `{ "or": [ … ] }` / `{ "and": [ … ] }` | Boolean groups |

For tables with a **single** primary-key column, filters may use `"id"` as an alias for that PK slug (REST commit and some helpers map `id` → PK slug).

## Examples

**Example excerpt** — equality and comparison:

```json
{
  "table": "tasks",
  "filter": {
    "status": 0,
    "points": { "gte": 2 }
  }
}
```

**Example excerpt** — OR, columns, pagination:

```json
{
  "table": "tasks",
  "filter": {
    "or": [
      { "owner": "alex" },
      { "owner": "sam" }
    ]
  },
  "columns": ["task_id", "title", "status", "points"],
  "order": [{ "column": "title", "direction": "asc" }],
  "limit": 20,
  "offset": 0
}
```

**Example excerpt** — filter by primary key slug:

```json
{
  "table": "tasks",
  "filter": { "task_id": "V1StGXR8_Z5jdHi6B-myT" }
}
```

If `has_more` is true, call again with `offset` increased by `limit`.
