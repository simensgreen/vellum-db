# Migrations

Flat migration files for the expense tracker. All objects use scope `expenses`.

Files in [../schemas/](../schemas/):

| File | Purpose |
| --- | --- |
| [migrate.up.json](../schemas/migrate.up.json) | Create tables, seed categories, save views |
| [migrate.down.json](../schemas/migrate.down.json) | Delete views and drop tables |

Format details: load **`vellum-db-meta`** and see `references/migration-format.md` in that skill.

Paths below are **relative to this skill directory** (the folder that contains [SKILL.md](../SKILL.md)). For `db_migrate`, prefix with the skill install path in the workspace (e.g. `skills/expenses/` → `skills/expenses/schemas/migrate.up.json`).

## Bootstrap

Load **`vellum-db-meta`**, then apply:

```json
{ "path": "schemas/migrate.up.json" }
```

Re-run returns `already_applied` (hash dedup).

Before bootstrap, optional check: `db_list_tables` with `scope: "expenses"`.

## Teardown

Requires `config.allowDropTable = true`:

```json
{ "path": "schemas/migrate.down.json" }
```

Drop order in the down file: views first, then `expenses`, then `category` (FK-safe).

## What migrate.up.json contains

1. **create** — `category` then `expenses` (TableDefinition DSL)
2. **seed** — 26 default categories (`on_conflict: ignore`)
3. **views** — `expenses_with_category` (query join), `spending_by_category` (aggregate)

## Tables (summary)

**`category`** — `category_id` (nanoid PK), `name`, `description`.

**`expenses`** — `expense_id` (nanoid PK), `amount`, `currency` (enum of ISO codes as strings in row JSON), `category_id` (ref → category), `description`, `spent_at`, optional `notes`.

Currency variants: `USD`, `EUR`, `GBP`, `JPY`, `CNY`, `CHF`, `CAD`, `AUD`, `RUB`, `INR`, `BRL`, `KRW`, `MXN`, `TRY`, `PLN`, `SEK`, `NOK`, `DKK`, `SGD`, `HKD`, `NZD`, `ZAR`, `CZK`, `HUF`, `ILS`, `AED`, `THB`, `IDR`, `MYR`, `PHP`.

## Views

**`expenses_with_category`** — query join; params `$from`, `$to` (ISO date-time).

**`spending_by_category`** — aggregate by category; same date params.

After bootstrap, load **`vellum-db`** for `db_run_view`:

```json
{
  "slug": "spending_by_category",
  "params": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-31T23:59:59.999Z"
  }
}
```

## Re-bootstrap

Same up file hash blocks re-apply. Change file content (new hash) or run down first (destructive).
