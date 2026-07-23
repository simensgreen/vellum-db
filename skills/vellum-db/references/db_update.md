# db_update

Patch rows matching a JSON filter. Filter MUST be a non-empty object (empty filter is rejected). Each matched row is merged with `patch` and re-validated against the table row schema. Patch keys are column **slugs**.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table slug |
| `filter` | yes | Non-empty JSON filter (column slugs) |
| `patch` | yes | Partial fields to set (`minProperties: 1`) |

## Output

`{ table, matched, changes }` — `matched` = rows selected by filter; `changes` = SQLite update count.

## Examples

**Example excerpt** — update by primary key slug:

```json
{
  "table": "tasks",
  "filter": { "task_id": "V1StGXR8_Z5jdHi6B-myT" },
  "patch": { "status": 1 }
}
```

**Example excerpt** — bulk status change:

```json
{
  "table": "tasks",
  "filter": { "status": 0 },
  "patch": { "status": 1 }
}
```

**Bad** — empty filter (rejected):

```json
{
  "table": "tasks",
  "filter": {},
  "patch": { "status": 1 }
}
```

Filter shapes are the same JSON filters as `db_query`. Single-PK tables may also accept `"id"` in the filter as an alias for the PK slug.
