# db_load

Import rows from a file into a table. Validates each row against the table row schema. Relative `path` resolves under the Vellum workspace (must stay inside it).

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `table` | yes | Target table (slug) |
| `path` | yes | Workspace-relative or absolute (inside workspace) |
| `mode` | yes | `csv` \| `json` \| `jsonl` \| `xlsx` |
| `on_conflict` | no | `abort` (default) \| `ignore` \| `replace` (by primary key) |

## Modes

| `mode` | File shape |
| --- | --- |
| `json` | Array of row objects (keys = column slugs) |
| `jsonl` | One JSON object per line |
| `csv` | Header row (slug names) + data rows |
| `xlsx` | Excel workbook (`.xlsx`); first sheet |

Primary key columns may appear in the file for conflict handling; omitted PK values use insert defaults when loading new rows.

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

**Example excerpt** — reload JSON replacing by primary key:

```json
{
  "table": "tasks",
  "path": "exports/tasks.json",
  "mode": "json",
  "on_conflict": "replace"
}
```

Export with `db_dump`. The Database app also supports direct upload via REST `POST /import?table=&filename=` (format inferred from filename).
