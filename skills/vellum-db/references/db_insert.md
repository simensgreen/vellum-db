# db_insert

Insert one row. `row` must match the table JSON Schema. Optional nanoid `id`; generated when omitted. Optional `on_conflict` for primary-key clashes.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table name |
| `row` | yes | Schema fields; optional `id` (nanoid string) |
| `on_conflict` | no | `abort` (default) \| `ignore` \| `replace` |

## Output

`{ table, id, changes, outcome, on_conflict }` where `outcome` is `inserted` \| `ignored` \| `replaced`.

## Examples

**Example excerpt** — insert (id auto-generated):

```json
{
  "table": "tasks",
  "row": {
    "title": "Ship plugin",
    "status": "open",
    "points": 3
  }
}
```

**Example excerpt** — replace existing row by id:

```json
{
  "table": "tasks",
  "row": {
    "id": "V1StGXR8_Z5jdHi6B-myT",
    "title": "Ship plugin",
    "status": "done",
    "points": 3
  },
  "on_conflict": "replace"
}
```

**Example excerpt** — ignore duplicate id:

```json
{
  "table": "tasks",
  "row": {
    "id": "V1StGXR8_Z5jdHi6B-myT",
    "title": "duplicate",
    "status": "open",
    "points": 1
  },
  "on_conflict": "ignore"
}
```
