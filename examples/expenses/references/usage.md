# Usage reference

Detailed expense tracker operations beyond the hub workflow. Load **`vellum-db`** for all row and view tools.

## Category management

### List categories

**Example excerpt:**

```json
{
  "table": "category",
  "order": [{ "column": "name", "direction": "asc" }],
  "limit": 50
}
```

### Add a custom category

**Example excerpt:**

```json
{
  "table": "category",
  "row": {
    "name": "Hobbies",
    "description": "Craft supplies, games, collectibles"
  }
}
```

### Lookup before insert

Match user phrasing to a seeded `name` (exact or closest). Prefer exact match:

**Example excerpt:**

```json
{
  "table": "category",
  "filter": { "name": "Groceries" },
  "limit": 1
}
```

If no match, offer to create a category or use `Other`.

## Record expenses

Always resolve `category_id` before `db_insert`. Pass `currency` as a string enum variant (`"EUR"`, not an index).

**Example excerpt** — with explicit date and notes:

```json
{
  "table": "expenses",
  "row": {
    "amount": 89.99,
    "currency": "EUR",
    "category_id": "<category_id>",
    "description": "Train ticket",
    "spent_at": "2026-07-15T09:30:00.000Z",
    "notes": "Round trip"
  }
}
```

Omit `spent_at` to use default `"now"`.

## Find expenses

### Saved view (preferred)

**Example excerpt:**

```json
{
  "slug": "expenses_with_category",
  "params": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-31T23:59:59.999Z"
  }
}
```

Paginate with view `limit`/`offset` if the saved definition is updated, or re-run with higher `offset` when `has_more` is true on ad-hoc queries.

### Ad-hoc query by category ref

**Example excerpt:**

```json
{
  "table": "expenses",
  "filter": { "category_id": "<category_id>" },
  "order": [{ "column": "spent_at", "direction": "desc" }],
  "limit": 20
}
```

### Text search on description

**Example excerpt:**

```json
{
  "table": "expenses",
  "filter": { "description": { "like": "%coffee%" } },
  "order": [{ "column": "spent_at", "direction": "desc" }]
}
```

## Reports

### Spending by category (saved view)

**Example excerpt:**

```json
{
  "slug": "spending_by_category",
  "params": {
    "from": "2026-01-01T00:00:00.000Z",
    "to": "2026-12-31T23:59:59.999Z"
  }
}
```

### Ad-hoc aggregate with currency filter

Sum only USD expenses in a range:

**Example excerpt:**

```json
{
  "table": "expenses",
  "joins": [
    {
      "ref": "category_id",
      "type": "inner",
      "select": { "name": "category_name" }
    }
  ],
  "metrics": [
    { "fn": "sum", "column": "amount", "as": "total_amount" }
  ],
  "group_by": ["category_name"],
  "filter": {
    "and": [
      { "currency": "USD" },
      { "spent_at": { "gte": "2026-07-01T00:00:00.000Z" } },
      { "spent_at": { "lte": "2026-07-31T23:59:59.999Z" } }
    ]
  },
  "order": [{ "column": "total_amount", "direction": "desc" }]
}
```

### Multi-currency

Amounts are stored in each row's native currency. There is no automatic FX conversion. For mixed-currency portfolios:

- Filter reports by a single `currency`, or
- Group by both `category_name` and `currency` in ad-hoc aggregates, or
- Present separate totals per currency in the user reply.

## Update and delete

Filters must be non-empty objects.

**Example excerpt** — fix amount on one expense:

```json
{
  "table": "expenses",
  "filter": { "expense_id": "<expense_id>" },
  "patch": { "amount": 16.50 }
}
```

**Example excerpt** — delete one expense:

```json
{
  "table": "expenses",
  "filter": { "expense_id": "<expense_id>" }
}
```

Deleting a `category` row fails while expenses reference it (`onDelete: restrict`). Reassign or delete expenses first.

## Import and export

**Example excerpt** — export expenses to CSV (workspace-relative path):

```json
{
  "table": "expenses",
  "path": "exports/expenses.csv",
  "mode": "csv"
}
```

**Example excerpt** — import from JSONL:

```json
{
  "table": "expenses",
  "path": "imports/expenses.jsonl",
  "mode": "jsonl"
}
```

Imported rows must satisfy the compiled row schema (`category_id` must exist in `category`).
