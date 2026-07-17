# db_delete

Delete rows matching a JSON filter. Filter MUST be a non-empty object (empty filter is rejected to prevent wiping a whole table).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table name |
| `filter` | yes | Non-empty JSON filter |

## Output

`{ table, deleted }` (or equivalent change count from the tool).

## Examples

**Example excerpt** — delete archived rows:

```json
{
  "table": "tasks",
  "filter": { "status": "archived" }
}
```

**Example excerpt** — delete one row by id:

```json
{
  "table": "tasks",
  "filter": { "id": "V1StGXR8_Z5jdHi6B-myT" }
}
```

**Bad** — empty filter (rejected):

```json
{
  "table": "tasks",
  "filter": {}
}
```

Filter shapes are the same JSON filters as `db_query` (equality, operators, `and`/`or`).
