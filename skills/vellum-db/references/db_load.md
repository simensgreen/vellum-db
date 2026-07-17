# db_load

Import rows from a file into a table. Validates each row against the table JSON Schema. Relative `path` resolves under the Vellum workspace (must stay inside it).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Target table |
| `path` | yes | Workspace-relative or absolute (inside workspace) |
| `mode` | yes | `csv` \| `json` \| `jsonl` \| `xls` |
| `on_conflict` | no | `abort` (default) \| `ignore` \| `replace` (by `id`) |

## Modes

| `mode` | File shape |
| --- | --- |
| `json` | Array of row objects |
| `jsonl` | One JSON object per line |
| `csv` | Header row + data rows |
| `xls` | Excel workbook (`.xlsx`); first sheet |

Optional `id` in the file is used for conflict handling; otherwise a nanoid is generated per row.

## Output

`{ table, path, mode, on_conflict, inserted, ignored, replaced }`.

## Examples

**Example excerpt** — load CSV:

```json
{
  "table": "tasks",
  "path": "imports/tasks.csv",
  "mode": "csv"
}
```

**Example excerpt** — reload JSON replacing by id:

```json
{
  "table": "tasks",
  "path": "exports/tasks.json",
  "mode": "json",
  "on_conflict": "replace"
}
```

Export with `db_dump`.
