# JSON Schema examples for vellum-db tables

Reference patterns for `db_create_table` and `db_alter_table` `add` entries. All table schemas must be `type: "object"` with non-empty `properties`. Never define `id`.

## Minimal required string table

```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "minLength": 1 }
  },
  "required": ["label"]
}
```

Maps to: `label TEXT NOT NULL` plus auto `id` (nanoid TEXT PRIMARY KEY).

## Mixed scalar types

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "count": { "type": "integer", "minimum": 0 },
    "score": { "type": "number" },
    "active": { "type": "boolean" }
  },
  "required": ["name"]
}
```

Maps to: `name TEXT NOT NULL`, `count INTEGER`, `score REAL`, `active INTEGER` (0/1).

## Nested object (JSON column)

```json
{
  "type": "object",
  "properties": {
    "event": { "type": "string" },
    "payload": {
      "type": "object",
      "properties": {
        "source": { "type": "string" },
        "meta": { "type": "object" }
      },
      "additionalProperties": true
    }
  },
  "required": ["event"]
}
```

`payload` maps to `TEXT` with JSON storage; validate nested shape at insert time via row validation in **`vellum-db`**.

## Array column

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["title"]
}
```

`tags` maps to `TEXT` (JSON array string).

## Enum and format hints

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["draft", "published", "archived"]
    },
    "published_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["status"]
}
```

Enum and `format` are JSON Schema constraints only; SQLite column remains `TEXT`.

## Alter: add nullable column

Use in `db_alter_table.add`:

```json
{
  "name": "notes",
  "schema": { "type": "string" }
}
```

New columns are nullable in SQLite even if you add them to `required` in a hand-edited schema — prefer defining `required` correctly at create time.

## Alter: drop column

```json
{
  "table": "tasks",
  "drop": ["legacy_field"]
}
```

Cannot drop `id` or the last remaining user column. Operation rebuilds the table; back up or export rows first via **`vellum-db`** if data matters.

## Invalid patterns (will fail)

| Pattern | Why |
| --- | --- |
| `"properties": { "id": … }` | `id` is reserved |
| `"properties": {}` | Need at least one property |
| Table name `_internal` | Leading `_` reserved |
| Property name `UserName` | Must be lowercase `[a-z][a-z0-9_]*` |
