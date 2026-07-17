# db_list_saved_queries

List saved named queries with optional filters and pagination.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `kind` | no | `query` \| `aggregate` |
| `name_prefix` | no | Names starting with this prefix |
| `limit` | no | Page size |
| `offset` | no | Skip N |

## Output

`{ queries, count, limit, offset, has_more }`. Each entry includes `name`, `kind`, `description`, `definition`, timestamps.

## Examples

**Example excerpt** — list all:

```json
{}
```

**Example excerpt** — only aggregates, first page:

```json
{
  "kind": "aggregate",
  "limit": 10,
  "offset": 0
}
```

**Example excerpt** — name prefix:

```json
{
  "name_prefix": "tasks_"
}
```
