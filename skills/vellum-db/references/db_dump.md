# db_dump

Export all rows from a table to a file. Includes nanoid `id`. Relative `path` resolves under the Vellum workspace (must stay inside it).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Source table |
| `path` | yes | Workspace-relative or absolute (inside workspace) |
| `mode` | yes | `csv` \| `json` \| `jsonl` \| `xls` |

## Modes

| `mode` | File shape |
| --- | --- |
| `json` | Pretty-printed array of row objects |
| `jsonl` | One JSON object per line |
| `csv` | Header row including `id` |
| `xls` | Excel workbook (`.xlsx`) |

## Output

`{ table, path, mode, count }`.

## Examples

**Example excerpt** — dump to JSON:

```json
{
  "table": "tasks",
  "path": "exports/tasks.json",
  "mode": "json"
}
```

**Example excerpt** — dump to CSV:

```json
{
  "table": "tasks",
  "path": "exports/tasks.csv",
  "mode": "csv"
}
```

Import with `db_load`.
