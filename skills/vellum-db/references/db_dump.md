# db_dump

Export all rows from a table to a file. Includes all columns (primary key slugs in header/keys). Relative `path` resolves under the Vellum workspace (must stay inside it).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Source table (slug) |
| `path` | yes | Workspace-relative or absolute (inside workspace) |
| `mode` | yes | `csv` \| `json` \| `jsonl` \| `xlsx` |

## Modes

| `mode` | File shape |
| --- | --- |
| `json` | Pretty-printed array of row objects |
| `jsonl` | One JSON object per line |
| `csv` | Header row with column slugs |
| `xlsx` | Excel workbook (`.xlsx`) |

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

Import with `db_load`. The Database app also supports direct download via REST `GET /export?table=&mode=` (filename `{table}.{mode}`).
