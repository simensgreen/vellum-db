---
name: expenses
description: >-
  Personal expense tracking and spending reports via vellum-db.
  Triggers: log expense, track spending, spending by category,
  expense report, budget, record purchase, list expenses.
metadata:
  vellum:
    display-name: Expense Tracker
    activation-hints:
      - "User asks to log, track, or list personal expenses"
      - "User asks for spending by category, month, or currency"
      - "User asks to run expense reports with date range"
    avoid-when:
      - "User wants generic SQL or schema DDL without expense context"
      - "User needs invoicing, accounting, or multi-user ledger"
    category: finance
    related_skills:
      - vellum-db
      - vellum-db-meta
---

# Expense Tracker

Load with `skill_load` and `{ "skill": "expenses" }`. Persists personal expenses in **vellum-db** tables (`category` reference + `expenses` journal). First-time setup: [references/install.md](references/install.md).

## When to Use

- Log a purchase with amount, currency, category, and date.
- List expenses for a date range with category names and descriptions.
- Report total spending grouped by category for a month or custom range.
- Bootstrap the expense tracker tables and saved views on a fresh database.
- Add a custom expense category (name + description).

## Do not use for

- **Generic table DDL** without expense context — load **`vellum-db-meta`** instead.
- **Ad-hoc queries** on unrelated tables — load **`vellum-db`** instead.
- Invoicing, double-entry accounting, payroll, or multi-user ledgers.
- Example query that should **not** load this skill: "Create a projects table with title and status columns."

## Overview

The expense tracker uses two tables in scope `expenses`: **`category`** (name + description) and **`expenses`** (amount, currency enum, ref to category, spent_at). Saved views join category data and support date-range parameters (`$from`, `$to`). Storage and validation come from the **vellum-db** plugin; this skill defines schemas, bootstrap order, and domain procedures.

## Workflow

Complete steps in order. Do not skip bootstrap when tables are missing.

1. Load this skill. For first-time host setup, follow [references/install.md](references/install.md).
2. Call `db_list_tables` with `scope: "expenses"`. If `category` or `expenses` is missing, load **`vellum-db-meta`** and bootstrap (step 3). Otherwise load **`vellum-db`** for row operations.
3. **Bootstrap** when tables or views are missing — apply [schemas/migrate.up.json](schemas/migrate.up.json) via `db_migrate` (see [references/migrations.md](references/migrations.md)). Workspace path when installed at `skills/expenses/`: `skills/expenses/schemas/migrate.up.json`.
   - Load **`vellum-db`** after bootstrap for inserts and queries.
4. **Record an expense** — resolve category, then insert:
   - `db_query` on `category` with filter `{ "name": "<category name>" }`.
   - `db_insert` into `expenses` with `category_id`, `amount`, `currency`, `description`, optional `spent_at` and `notes`.
5. **Find expenses** — prefer `db_run_view` on `expenses_with_category` with ISO date-time params `from` and `to`.
6. **Report by category** — `db_run_view` on `spending_by_category` with the same date params.

Advanced scenarios: [references/usage.md](references/usage.md).

## Tool choice

| Goal | Tool | When |
| --- | --- | --- |
| First-time schema | `db_migrate` | Bootstrap; load **vellum-db-meta** |
| Resolve category | `db_query` on `category` | Before every insert |
| Log expense | `db_insert` | After category lookup |
| List with category info | `db_run_view` | Prefer saved view over ad-hoc join |
| Totals by category | `db_run_view` `spending_by_category` | Date-range reports |
| Ad-hoc analysis | `db_query` / `db_aggregate` | See [references/usage.md](references/usage.md) |

## Output contract

Return Markdown to the user:

1. **Setup** (when bootstrap ran) — one line: tables/views created or already present.
2. **Summary** — one sentence (≤ 40 words): what was logged, found, or totaled.
3. **Details** — table or bullet list (≤ 15 rows) with `amount`, `currency`, `category_name`, `spent_at` (and `description` for row lists).
4. **Notes** — optional (≤ 3 bullets): multi-currency caveat, missing category, pagination (`has_more`).

## Examples

### Example 1

**Input (user):** "Log $15 coffee in USD under Food & dining."

**Output (tool calls):**

1. `db_query`:

```json
{
  "table": "category",
  "filter": { "name": "Food & dining" },
  "limit": 1
}
```

2. `db_insert`:

```json
{
  "table": "expenses",
  "row": {
    "amount": 15,
    "currency": "USD",
    "category_id": "<category_id from step 1>",
    "description": "Coffee"
  }
}
```

**Reply shape:** Summary confirms the logged amount; Details show one row with category name.

### Example 2

**Input (user):** "How much did I spend by category in July 2026?"

**Output (tool call):**

```json
{
  "slug": "spending_by_category",
  "params": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-31T23:59:59.999Z"
  }
}
```

**Reply shape:** Summary states the period; Details list `category_name`, `total_amount`, `expense_count` sorted by total descending.

## Common pitfalls

- Inserting before bootstrap — call `db_list_tables` scope `expenses` first.
- Wrong bootstrap order — create and seed `category` before `expenses` (ref dependency).
- Guessing `category_id` — always look up by `name` via `db_query`.
- Enum currency as integer — pass variant **strings** (`"USD"`, not `0`).
- Missing view params — `$from` and `$to` must be bound on both saved views.
- Multi-currency totals — amounts are not converted; group or filter by `currency` when mixing codes.
- Empty filter on `db_update` / `db_delete` — rejected; always pass a non-empty filter object.
- Deleting a category with expenses — `onDelete: restrict` blocks removal while rows reference it.

## Verification checklist

- [ ] Called `db_list_tables` scope `expenses` before first insert.
- [ ] Both `category` and `expenses` exist; seed categories present after bootstrap.
- [ ] Views `expenses_with_category` and `spending_by_category` exist (`db_list_views` scope `expenses`).
- [ ] Every expense insert used a resolved `category_id` and string `currency` code.
- [ ] Date-range reads used `db_run_view` with `from` and `to` ISO date-time params.
- [ ] User reply follows Output contract (Summary + Details).
