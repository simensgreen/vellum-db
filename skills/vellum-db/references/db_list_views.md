# db_list_views

List named views with optional filters and pagination.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `kind` | no | `query` \| `aggregate` |
| `scope` | no | Exact scope (`[a-z][a-z0-9_]*`). `null` = only unscoped. Omit = all |
| `slug_prefix` | no | Slugs starting with this prefix |
| `limit` | no | Page size |
| `offset` | no | Skip N |

## Output

`{ views, page_count, total_count, limit, offset, has_more }`. Each entry includes `slug`, `name`, `kind`, `scope`, `description`, `definition`, `param_names`, timestamps.

## Examples

**Example excerpt** — list all:

```json
{}
```

**Example excerpt** — by scope:

```json
{
  "scope": "work",
  "limit": 10,
  "offset": 0
}
```

**Example excerpt** — only views without a scope:

```json
{
  "scope": null
}
```
