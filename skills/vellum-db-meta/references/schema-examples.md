# TableDefinition DSL examples for vellum-db

Reference patterns for TableDefinition entries in migration `create[]` / `alter[]`. All tables use the **TableDefinition DSL** — no JSON Schema create path, no implicit `id`.

Each `create[]` entry must include **`scope`** (separate from `definition`; not inside the TableDefinition object).

Primary key is declared per column with `"primaryKey": true` (composite keys: mark multiple columns).

## Minimal table with nanoid primary key

Migration `create[]` entry:

```json
{
  "scope": "demo",
  "definition": {
    "slug": "tasks",
    "name": "Tasks",
    "columns": [
      {
        "name": "Task ID",
        "slug": "task_id",
        "primaryKey": true,
        "data": { "type": "nanoid", "default": "random" }
      },
      {
        "name": "Title",
        "slug": "title",
        "data": { "type": "str", "minLen": 1 }
      }
    ]
  }
}
```

TableDefinition only (inside `definition`):

```json
{
  "slug": "tasks",
  "name": "Tasks",
  "columns": [
    {
      "name": "Task ID",
      "slug": "task_id",
      "primaryKey": true,
      "data": { "type": "nanoid", "default": "random" }
    },
    {
      "name": "Title",
      "slug": "title",
      "data": { "type": "str", "minLen": 1 }
    }
  ]
}
```

## Mixed scalar types

```json
{
  "slug": "metrics",
  "name": "Metrics",
  "columns": [
    {
      "name": "Metric ID",
      "slug": "metric_id",
      "primaryKey": true,
      "data": { "type": "nanoid", "default": "random" }
    },
    { "name": "Name", "slug": "name", "data": { "type": "str" } },
    { "name": "Count", "slug": "count", "data": { "type": "int", "min": 0 } },
    { "name": "Score", "slug": "score", "data": { "type": "float" } },
    { "name": "Active", "slug": "active", "data": { "type": "bool", "default": false } }
  ]
}
```

## Enum and timestamp

```json
{
  "slug": "posts",
  "name": "Posts",
  "columns": [
    {
      "name": "Post ID",
      "slug": "post_id",
      "primaryKey": true,
      "data": { "type": "nanoid", "default": "random" }
    },
    {
      "name": "Status",
      "slug": "status",
      "data": { "type": "enum", "variants": ["draft", "published", "archived"], "default": 0 }
    },
    {
      "name": "Published at",
      "slug": "published_at",
      "data": { "type": "timestamp", "default": "now" }
    }
  ]
}
```

## Reference column

```json
{
  "slug": "comments",
  "name": "Comments",
  "columns": [
    {
      "name": "Comment ID",
      "slug": "comment_id",
      "primaryKey": true,
      "data": { "type": "nanoid", "default": "random" }
    },
    {
      "name": "Post",
      "slug": "post_id",
      "data": {
        "type": "ref",
        "table": "posts",
        "column": "post_id",
        "onDelete": "cascade"
      }
    },
    { "name": "Body", "slug": "body", "data": { "type": "str" } }
  ]
}
```

`ref.column` must reference a column with `"primaryKey": true` on the target table.

## Composite primary key

```json
{
  "slug": "memberships",
  "name": "Memberships",
  "columns": [
    { "name": "User", "slug": "user_id", "primaryKey": true, "data": { "type": "str" } },
    { "name": "Team", "slug": "team_id", "primaryKey": true, "data": { "type": "str" } },
    { "name": "Role", "slug": "role", "data": { "type": "str" } }
  ]
}
```

## Alter: add column

```json
{
  "table": "tasks",
  "add": [
    {
      "name": "Owner",
      "slug": "owner",
      "column": {
        "name": "Owner",
        "slug": "owner",
        "data": { "type": "str" }
      }
    }
  ]
}
```

## Alter: drop column

```json
{
  "table": "tasks",
  "drop": ["legacy_field"]
}
```

Cannot drop primary key columns. Dropping user columns rebuilds the table; export first if data matters.

## Invalid patterns

| Pattern | Why |
| --- | --- |
| No column with `primaryKey: true` | At least one PK column required |
| `bool` without `default` | Bool columns require `default: true` or `false` |
| `ref` without `column` | Reference target PK column is required |
| Table slug `_internal` | Leading `_` reserved for meta tables |
