# db_list_tables

Discover registered tables: name, scope, JSON Schema, columns, timestamps. Prefer this before query or write when names or columns are unknown.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `scope` | no | Exact scope (`[a-z][a-z0-9_]*`). `null` = only unscoped. Omit = all |
| `name_prefix` | no | Names starting with this prefix |
| `limit` | no | Page size (capped by `maxRowsPerQuery`) |
| `offset` | no | Skip N rows |

## Output

`{ tables, count, limit, offset, has_more }`. Each table includes `name`, `scope`, `schema`, `columns`, timestamps.

## Examples

**Example excerpt** — list everything (empty input):

```json
{}
```

**Example excerpt** — one scope, first page:

```json
{
  "scope": "expenses",
  "limit": 20,
  "offset": 0
}
```

**Example excerpt** — only tables without a scope:

```json
{
  "scope": null
}
```

**Example excerpt** — name prefix:

```json
{
  "name_prefix": "task"
}
```
