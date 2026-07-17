# db_sql

Escape hatch: run a single raw SQL statement. Prefer JSON tools (`db_query`, `db_aggregate`, …) for routine work. Behavior depends on `config.rawSqlMode`.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `sql` | yes | One statement only — no semicolons |

## Modes (`config.rawSqlMode`)

| Mode | Behavior |
| --- | --- |
| `select-only` | SELECT / WITH only; writes rejected |
| `on` | Any single statement allowed |
| `off` | Tool disabled |

SELECT results may be truncated at `maxRowsPerQuery` (`truncated: true` when clipped).

## Output

Select: `{ kind: "select", count, truncated, rows }`. Exec: `{ kind: "exec", changes, lastInsertRowid }`.

## Examples

**Example excerpt** — SELECT (safe in `select-only` and `on`):

```json
{
  "sql": "SELECT status, COUNT(*) AS n FROM tasks GROUP BY status"
}
```

**Bad** — multiple statements (rejected):

```json
{
  "sql": "DELETE FROM tasks; SELECT 1"
}
```

Do not use for routine filters or aggregates expressible as JSON.
