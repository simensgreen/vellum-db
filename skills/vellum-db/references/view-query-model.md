# View query model

Reference for JSON query and aggregate definitions in saved views (authored in migration files, run via `db_run_view`).

## Query vs aggregate

| Field | `kind: query` | `kind: aggregate` |
| --- | --- | --- |
| `table` | required base table | required base table |
| `filter` | WHERE (base + join aliases) | WHERE (base + join aliases) |
| `having` | — | HAVING on metric aliases |
| `order` | sort rows | sort groups (columns or metric aliases) |
| `limit` / `offset` | pagination | pagination |
| `columns` | projected row slugs | — |
| `joins` | optional ref joins | optional ref joins |
| `metrics` | — | required |
| `group_by` | — | optional (base + join aliases) |

Both kinds support `"$param"` placeholders anywhere in the definition JSON. Bind them at run time via `db_run_view { slug, params }`.

## JoinSpec

```json
{
  "ref": "project_ref",
  "source": "projects",
  "type": "inner",
  "select": { "name": "project_name" }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `ref` | yes | Ref column slug on `source` table |
| `source` | no | Table slug already in the join graph; default = base table for the first join |
| `type` | no | `left` (default), `inner`, or `right` |
| `select` | yes | Map joined-table column slug → output alias |

Forward ref semantics: `source.ref → joined.primary_key`.

| `type` | Result |
| --- | --- |
| `left` | All `source` rows; joined columns NULL when no match |
| `inner` | Only rows with a match |
| `right` | All joined (parent) rows; source columns NULL when no match |

### Multi-hop

List joins in order. Each join may set `source` to a table introduced by an earlier join:

```json
{
  "table": "tasks",
  "joins": [
    { "ref": "project_ref", "select": { "name": "project_name" } },
    {
      "source": "projects",
      "ref": "region_ref",
      "select": { "name": "region_name" }
    }
  ]
}
```

Dev seed example: view slug `tasks_with_region`.

## Filters and limits

- **Query filter** — JSON filter on base columns and join output aliases.
- **Aggregate filter** — applied before `GROUP BY`.
- **Aggregate having** — JSON filter on metric `as` aliases after grouping.
- **Limit** — capped by `config.maxRowsPerQuery`; aggregate queries may combine with `order` for top-N.

## Restrictions

- Joins only via declared `ref` columns (no arbitrary `ON` expressions).
- Aggregate `metrics[].column` must name a **base table** column, not a join alias.
- Parent→many row queries duplicate parent rows; use aggregate + `group_by` for per-parent stats.
- RIGHT JOIN row queries may return NULL base columns for parent-only rows (see seed `orphan_projects`).

## Dev seed examples

| Slug | Kind | Demonstrates |
| --- | --- | --- |
| `tasks_with_project` | query | LEFT join |
| `tasks_with_project_inner` | query | INNER join |
| `orphan_projects` | query | RIGHT join |
| `tasks_with_region` | query | multi-hop join |
| `tasks_filtered` | query | params + filter |
| `points_by_status` | aggregate | group_by without join |
| `points_by_project` | aggregate | join + filter + having + limit |
| `top_projects_by_points` | aggregate | join + order + limit |

Fresh dev DB required after seed schema changes (`regions`, `projects.region_ref`): delete `data/vellum-db.sqlite` or rerun seed on empty catalog.

## Tool mapping

| Operation | Tool |
| --- | --- |
| Ad-hoc query | `db_query` |
| Ad-hoc aggregate | `db_aggregate` |
| Author | Domain `migrate.up.json` (`db_migrate`) |
| Run | `db_run_view` |

Definition shapes match `db_query` / `db_aggregate` tool input.
