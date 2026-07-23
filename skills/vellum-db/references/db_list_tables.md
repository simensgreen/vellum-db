# db_list_tables

Discover registered tables: name, scope, **TableDefinition**, column slugs, timestamps. Prefer this before query or write when names or columns are unknown.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `scope` | no | Exact scope (`[a-z][a-z0-9_]*`). `null` = only unscoped. Omit = all |
| `name_prefix` | no | Table names starting with this prefix |
| `limit` | no | Page size (capped by `maxRowsPerQuery`) |
| `offset` | no | Skip N tables |

## Output

`{ tables, count, limit, offset, has_more }`. Each table includes:

| Field | Meaning |
| --- | --- |
| `name` | Table slug (same as `definition.slug`) |
| `scope` | Optional scope label or `null` |
| `definition` | Full **TableDefinition** object |
| `columns` | `{ name, sqlType, notNull, jsonStored }[]` — `name` is the column **slug** |
| `created_at` / `updated_at` | ISO timestamps |

Use `definition.columns` for display names and constraints; use `columns[].name` (slugs) in `db_query` filters and row objects.

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
