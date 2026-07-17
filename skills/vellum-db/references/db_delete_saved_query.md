# db_delete_saved_query

Remove a saved named query by `name`.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Saved query name (`[a-z][a-z0-9_]*`) |

## Output

Confirmation with the deleted `name`.

## Examples

**Example excerpt** — delete by name:

```json
{
  "name": "open_tasks"
}
```

List names first with `db_list_saved_queries` when unsure.
