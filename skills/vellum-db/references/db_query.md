# db_query

Read rows with a JSON filter (not SQL). Supports order, column projection, and `limit`/`offset` pagination (`has_more`).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table name |
| `filter` | no | JSON filter object |
| `order` | no | `[{ "column", "direction": "asc"\|"desc" }]` |
| `limit` | no | Capped by `maxRowsPerQuery` |
| `offset` | no | Default `0` |
| `columns` | no | Subset to return (default: all including `id`) |

## Output

`{ table, count, limit, offset, has_more, rows }`. Each row includes nanoid `id` plus schema fields.

## Filters

Equality is a plain value. Comparisons use operators. Combine with `and` / `or`.

| Shape | Meaning |
| --- | --- |
| `{ "status": "open" }` | Equals |
| `{ "points": { "gte": 2 } }` | Comparison (`gt`/`gte`/`lt`/`lte`/`ne`) |
| `{ "status": { "in": ["open", "done"] } }` | Membership |
| `{ "title": { "like": "%plugin%" } }` | LIKE |
| `{ "or": [ … ] }` / `{ "and": [ … ] }` | Boolean groups |

## Examples

**Example excerpt** — equality and comparison:

```json
{
  "table": "tasks",
  "filter": {
    "status": "open",
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
  "columns": ["id", "title", "status", "points"],
  "order": [{ "column": "title", "direction": "asc" }],
  "limit": 20,
  "offset": 0
}
```

**Example excerpt** — `in` and `like`:

```json
{
  "table": "tasks",
  "filter": {
    "status": { "in": ["open", "blocked"] },
    "title": { "like": "%plugin%" }
  }
}
```

If `has_more` is true, call again with `offset` increased by `limit`.
