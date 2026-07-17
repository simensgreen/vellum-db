# db_update

Patch rows matching a JSON filter. Filter MUST be a non-empty object (empty filter is rejected). Each matched row is merged with `patch` and re-validated against the table schema.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table name |
| `filter` | yes | Non-empty JSON filter |
| `patch` | yes | Partial fields to set (`minProperties: 1`) |

## Output

`{ table, matched, updated }` (or equivalent change counts from the tool).

## Examples

**Example excerpt** — update by nanoid id:

```json
{
  "table": "tasks",
  "filter": { "id": "V1StGXR8_Z5jdHi6B-myT" },
  "patch": { "status": "done" }
}
```

**Example excerpt** — bulk status change:

```json
{
  "table": "tasks",
  "filter": { "status": "blocked" },
  "patch": { "status": "open" }
}
```

**Bad** — empty filter (rejected):

```json
{
  "table": "tasks",
  "filter": {},
  "patch": { "status": "done" }
}
```

Filter shapes are the same JSON filters as `db_query` (equality, operators, `and`/`or`).
