# db_insert

Insert one row. `row` must match the table's compiled row schema (column **slugs** as keys). Primary key columns may be omitted when defaults apply (e.g. `nanoid` + `default: "random"`). Optional `on_conflict` for primary-key clashes.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Table slug |
| `row` | yes | Object keyed by column slug |
| `on_conflict` | no | `abort` (default) \| `ignore` \| `replace` |

Conflict detection uses **primary key column(s)** only.

## Output

`{ table, id, changes, outcome, on_conflict }` where:

- `outcome` is `inserted` \| `ignored` \| `replaced`
- `id` — single PK value as string, or composite PK joined with `:`

## Examples

**Example excerpt** — insert (PK auto-generated):

```json
{
  "table": "tasks",
  "row": {
    "title": "Ship plugin",
    "status": 0,
    "points": 3
  }
}
```

(`task_id` omitted; nanoid default applies when the PK column is `task_id`.)

**Example excerpt** — replace existing row by primary key:

```json
{
  "table": "tasks",
  "row": {
    "task_id": "V1StGXR8_Z5jdHi6B-myT",
    "title": "Ship plugin",
    "status": 1,
    "points": 3
  },
  "on_conflict": "replace"
}
```

**Example excerpt** — ignore duplicate primary key:

```json
{
  "table": "tasks",
  "row": {
    "task_id": "V1StGXR8_Z5jdHi6B-myT",
    "title": "duplicate",
    "status": 0,
    "points": 1
  },
  "on_conflict": "ignore"
}
```
