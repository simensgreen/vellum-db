# db_delete

Delete rows matching a JSON filter. Filter MUST be a non-empty object (empty filter is rejected to prevent wiping a whole table).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table slug |
| `filter` | yes | Non-empty JSON filter (column slugs) |

## Output

`{ table, changes }` — SQLite delete count for matched rows.

## Examples

**Example excerpt** — delete by status:

```json
{
  "table": "tasks",
  "filter": { "status": 2 }
}
```

**Example excerpt** — delete one row by primary key:

```json
{
  "table": "tasks",
  "filter": { "task_id": "V1StGXR8_Z5jdHi6B-myT" }
}
```

**Bad** — empty filter (rejected):

```json
{
  "table": "tasks",
  "filter": {}
}
```

Filter shapes are the same JSON filters as `db_query`. Single-PK tables may accept `"id"` as an alias for the PK slug.
