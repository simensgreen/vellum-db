# vellum-db

**Shared structured storage for Vellum agents.**

A Vellum plugin that gives every skill and workflow a common place to keep tabular data — create tables from **TableDefinition DSL**, insert and update rows, filter and aggregate with JSON (not ad-hoc SQL), and save named queries for reuse. One storage system; many domains.

## Why this exists

Agents often need durable, structured state: expenses, diet logs, birthdays, price watches, habits, inventories. Those needs look different at first look, but under the hood they are the same: tables, rows, filters, and aggregates.

Without a shared store, each feature tends to ship its own plugin and its own CRUD tools. That duplicates work and fragments data. **vellum-db** is the opposite approach:

- **One plugin** owns persistence, validation, query, and aggregation.
- **Domain logic lives in skills** — table names, schemas, when to query, which views to run, and why — not in new TypeScript tools.
- An agent that loads the right skill can use the shared tools immediately. No per-domain CRUD code required.

Example: the expense tracker skill in [`examples/expenses/`](examples/expenses/) documents `category` and `expenses` tables, seed categories, saved views with date params, and how to log or report spending. Copy to workspace `skills/expenses/` to activate (see [references/install.md](examples/expenses/references/install.md)). The skill does not implement storage; it teaches the agent how to drive **vellum-db**.

## What you can build on it

Anything that needs structured storage and/or aggregation, for example:

- Expense and budget tracking  
- Diet / nutrition logs  
- Birthdays and reminders  
- Price monitoring  
- Habit streaks, inventories, simple CRMs  

If the shape fits “rows in tables + filters + rollups,” a skill on top of this plugin is enough.

## How it works (agent view)

1. **Define schema** — flat migration files (`db_migrate`) or Database app REST. **`scope` is required** when creating tables/views; omit `scope` on list calls to see all. See **`vellum-db-meta`**.
2. **Write and change rows** — `db_insert`, `db_update`, `db_delete` with JSON filters (column slugs).
3. **Read and analyze** — `db_query` (filter / order / page) and `db_aggregate` (count, sum, avg, min, max, group by).
4. **Reuse analysis** — `db_run_view` with `$param` placeholders (views defined in domain migrations).
5. **Discover** — `db_list_tables`, `db_list_views`, `db_list_migrations`.
6. **Import / export** — `db_load` / `db_dump` (`csv`, `json`, `jsonl`, `xlsx`).

Built-in skills:

| Skill | Load | Role |
| --- | --- | --- |
| `vellum-db` | `skill_load { "skill": "vellum-db" }` | Query, aggregate, row ops, views, optional SQL escape hatch |
| `vellum-db-meta` | `skill_load { "skill": "vellum-db-meta" }` | Author and apply schema migrations |

Domain skills should depend on these: spell out table names, schemas, and procedures; call the shared `db_*` tools.

Example domain skill (not bundled in the plugin index): [`examples/expenses/`](examples/expenses/) — personal expense tracking with category reference table and parameterized views.

## REST API

OpenAPI 3.1 spec: [`openapi.json`](./openapi.json) (generated via [`@asteasolutions/zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi) — `bun run openapi`). Base URL: `/v1/x/plugins/vellum-db/`; auth via Vellum gateway (`settings.read`).

## Database app

App id `plugins~vellum-db~tables` (directory `apps/tables/`). UI display name: **Database**.

- Browse tables and paginated rows; create tables and alter schema (visual column editor or advanced JSON **TableDefinition**).
- Staged row edits with batch commit via REST `POST /rows/commit` (`insert`, `update`, `delete` maps).
- Import/export via REST `GET /export` and `POST /import` (direct file download/upload; import format from filename).
- Overview dashboard via `GET /stats`.
- Uses `window.vellum.fetch` against the REST routes and `window.vellum.subscribe` with tags from `sync-tags.ts` for live refresh.
- Library card preview renders a static table icon when the host omits the fetch proxy (`isCardPreview()`).

Local UI dev (no Vellum restart):

```bash
bun run dev:app
```

Open `http://localhost:5173`. Card preview mock: `http://localhost:5173/?preview=1`.

## Design notes

- **Vellum plugin layout** — matches plugin-builder: `package.json` (+ `vellum: {}`), `config.json`, `hooks/`, `tools/`, `skills/`, `src/`; runtime DB under host-managed `data/` (`InitContext.pluginStorageDir`).
- **In-process SQLite** — uses **`bun:sqlite`** from the Vellum Bun runtime (no external SQLite binary or MCP sidecar). DB opens in `init`, closes in `shutdown`.
- **Always-on `tools/`** — required so tools share the `init` connection via `src/`. Skill `TOOLS.json` sandboxes cannot import outside the skill dir. Skills still teach *when* to call tools via `skill_load`.
- **Workspace-global** data (not per-conversation).
- **JSON-first** — routine work uses structured tool inputs, not hand-written SQL. `db_sql` exists as a gated escape hatch (`config.rawSqlMode`).
- **Shared, not siloed** — any skill in the workspace can use the same tables; use `scope` and clear naming so domains stay discoverable.

## Alternatives (MCP)

Vellum can also attach MCP servers. Nearest options and how this project differs:

| Option | Closest role | How it differs from vellum-db |
| --- | --- | --- |
| [mini-app-mcp](https://github.com/ynishi/mini-app-mcp) | Schema-driven CRUD + aggregates over SQLite via MCP tools | Closest product idea. Schema is usually `schema.yaml` / mount config, not agent-created JSON Schema + Ajv. Runs as an MCP process, not a Vellum plugin on `bun:sqlite`. |
| [mcp-server-sqlite](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/sqlite) (archived reference) / community forks e.g. [mcp-sqlite-server](https://www.npmjs.com/package/mcp-sqlite-server) | Generic SQLite access for agents | **SQL-first** (`read_query` / `write_query` / invent DDL). No JSON filters, saved `$param` queries, `scope`, or domain-skill contract like vellum-db. |
| [@berthojoris/mcp-sqlite-server](https://github.com/berthojoris/sqlite-mcp) | CRUD-shaped SQLite tools + permissions | Still SQL/DB-admin oriented; not a shared JSON Schema catalog for many domain skills. |
| Memory MCPs ([sqlite-memory-mcp](https://github.com/RMANOV/sqlite-memory-mcp), [mcp-memory-sqlite](https://github.com/pavex/mcp-memory-sqlite)) | Long-term notes / knowledge graph / FTS | Different problem (memory), not expense/diet/birthday-style tables. |

**When MCP is enough:** you want an agent to run SQL against a SQLite file and are fine teaching schemas in prompts.

**When vellum-db fits better:** many domain skills should share one validated store; routine ops stay JSON (filters, aggregates, views, import/export); persistence lives in-process via Bun’s SQLite in the Vellum runtime.

Browse more servers: [MCP Registry](https://registry.modelcontextprotocol.io/).

## Config

See `config.json` and [AGENTS.md](./AGENTS.md) for keys (`maxRowsPerQuery`, `rawSqlMode`, `databasePath`, `allowDropTable`) and layout for contributors.

## Install (Vellum workspace)

`assistant plugins install` materializes the plugin tree but **does not** run `bun install`. The host only links a small shared whitelist (today: `zod`) into `<workspace>/node_modules`. This plugin’s runtime deps (`ajv`, `@truto/sqlite-builder`, `nanoid`, `xlsx`) are not on that list.

After install (or upgrade), from the plugin directory:

```bash
cd plugins/vellum-db && bun install
```

Longer-term options (vendor / zero-deps rewrite / ship `node_modules`) are listed in [AGENTS.md](./AGENTS.md).

## Develop

```bash
bun install
bunx tsc --noEmit
bunx tsc --noEmit -p apps/tables
bun test
bun run dev:app   # Database app UI at http://localhost:5173
```

Pre-commit hook (enabled by `bun install`) regenerates `openapi.json` when you commit REST/API schema changes.

This repository root **is** the plugin (`hooks/`, `tools/`, `skills/`, `src/`, `routes/`, `apps/`).
