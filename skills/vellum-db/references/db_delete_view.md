# db_delete_view

Remove a named view by `slug`.

## Inputs

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | View slug (`[a-z][a-z0-9_]*`) |

## Output

Confirmation with the deleted `slug`.

## Examples

**Example excerpt** — delete by slug:

```json
{
  "slug": "open_tasks"
}
```

List slugs first with `db_list_views` when unsure.
