# db_list_migrations

Paginated list of applied schema migrations from `_migrations`.

## Input

| Field | Type | Default |
| --- | --- | --- |
| `limit` | integer | plugin default page size |
| `offset` | integer | `0` |

## Output

```json
{
  "migrations": [
    {
      "id": 2,
      "hash": "…",
      "name": "migrate.down.json",
      "applied_at": "2026-07-23T12:00:00.000Z"
    }
  ],
  "page_count": 2,
  "total_count": 2,
  "limit": 50,
  "offset": 0,
  "has_more": false
}
```

Ordered by `id` descending (newest first). API-recorded migrations use names like `api:create:tasks:2026-07-23T…`.
