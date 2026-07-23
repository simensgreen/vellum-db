# Schema, seed data, and views

Table definitions, default categories, and saved views for the expense tracker. All objects use scope `expenses`.

JSON payloads live in [`../schemas/`](../schemas/) (copy-paste into tool calls).

## Contents

1. [Bootstrap order](#bootstrap-order)
2. [Schema files](#schema-files)
3. [Table `category`](#table-category)
4. [Seed categories](#seed-categories)
5. [Table `expenses`](#table-expenses)
6. [View `expenses_with_category`](#view-expenses_with_category)
7. [View `spending_by_category`](#view-spending_by_category)
8. [Idempotency](#idempotency)

## Bootstrap order

Complete in order. Load **`vellum-db-meta`** for steps 1–2 and 4; load **`vellum-db`** for steps 3 and 5–6.

1. `db_create_table` — payload from [category.table.json](../schemas/category.table.json)
2. `db_insert` — one row per entry in [category.seed.json](../schemas/category.seed.json)
3. `db_create_table` — payload from [expenses.table.json](../schemas/expenses.table.json)
4. `db_save_view` — payload from [expenses-with-category.view.json](../schemas/expenses-with-category.view.json)
5. `db_save_view` — payload from [spending-by-category.view.json](../schemas/spending-by-category.view.json)

Before each create, check `db_list_tables` or `db_list_views` to avoid duplicates.

## Schema files

| File | Tool | Purpose |
| --- | --- | --- |
| [category.table.json](../schemas/category.table.json) | `db_create_table` | Category reference table |
| [category.seed.json](../schemas/category.seed.json) | `db_insert` | 26 default categories (array of rows) |
| [expenses.table.json](../schemas/expenses.table.json) | `db_create_table` | Expense journal table |
| [expenses-with-category.view.json](../schemas/expenses-with-category.view.json) | `db_save_view` | Query view with category join |
| [spending-by-category.view.json](../schemas/spending-by-category.view.json) | `db_save_view` | Aggregate view by category |

## Table `category`

Reference table: one row per expense category with a human-readable name and description.

Columns: `category_id` (nanoid PK), `name` (str), `description` (str).

Load [category.table.json](../schemas/category.table.json) as the `db_create_table` input.

## Seed categories

Insert after creating `category`. Read [category.seed.json](../schemas/category.seed.json) — array of `{ name, description }` objects. For each entry:

**Example excerpt** — one seed insert:

```json
{
  "table": "category",
  "row": {
    "name": "Groceries",
    "description": "Supermarket and market food"
  }
}
```

Omit `category_id` (nanoid default applies). Skip rows that already exist (query by `name` first) when re-running bootstrap.

## Table `expenses`

Expense journal. `currency` is an enum of ISO 4217 codes (string variant names in row JSON). `category_id` references `category.category_id`.

Currency variants: `USD`, `EUR`, `GBP`, `JPY`, `CNY`, `CHF`, `CAD`, `AUD`, `RUB`, `INR`, `BRL`, `KRW`, `MXN`, `TRY`, `PLN`, `SEK`, `NOK`, `DKK`, `SGD`, `HKD`, `NZD`, `ZAR`, `CZK`, `HUF`, `ILS`, `AED`, `THB`, `IDR`, `MYR`, `PHP`.

Load [expenses.table.json](../schemas/expenses.table.json) as the `db_create_table` input.

**Example excerpt** — insert after category lookup:

```json
{
  "table": "expenses",
  "row": {
    "amount": 42.50,
    "currency": "USD",
    "category_id": "<category_id>",
    "description": "Weekly groceries"
  }
}
```

## View `expenses_with_category`

Query view: expense rows joined to category, filtered by `spent_at` range. Params: `$from`, `$to` (ISO date-time strings).

Save: [expenses-with-category.view.json](../schemas/expenses-with-category.view.json) via `db_save_view`.

**Example excerpt** — `db_run_view`:

```json
{
  "slug": "expenses_with_category",
  "params": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-31T23:59:59.999Z"
  }
}
```

## View `spending_by_category`

Aggregate view: sum and count per category for a date range. Params: `$from`, `$to`.

Save: [spending-by-category.view.json](../schemas/spending-by-category.view.json) via `db_save_view`.

**Example excerpt** — `db_run_view`:

```json
{
  "slug": "spending_by_category",
  "params": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-31T23:59:59.999Z"
  }
}
```

`metrics[].column` must name a base-table column (`amount`), not a join alias. `group_by` may use join output aliases (`category_name`).

## Idempotency

- Before `db_create_table`, call `db_list_tables` with `scope: "expenses"` and skip if the slug exists.
- Before seeding, `db_query` `category` by `name`; insert only missing names from [category.seed.json](../schemas/category.seed.json).
- Before `db_save_view`, call `db_list_views` with `scope: "expenses"`; upsert or skip if slug exists.
