# vellum-db

**Shared structured storage for Vellum agents.**

A Vellum plugin that gives every skill and workflow a common place to keep tabular data — create tables from JSON Schema, insert and update rows, filter and aggregate with JSON (not ad-hoc SQL), and save named queries for reuse. One storage system; many domains.

## Why this exists

Agents often need durable, structured state: expenses, diet logs, birthdays, price watches, habits, inventories. Those needs look different at first look, but under the hood they are the same: tables, rows, filters, and aggregates.

Without a shared store, each feature tends to ship its own plugin and its own CRUD tools. That duplicates work and fragments data. **vellum-db** is the opposite approach:

- **One plugin** owns persistence, validation, query, and aggregation.
- **Domain logic lives in skills** — table names, schemas, when to query, which saved queries to run, and why — not in new TypeScript tools.
- An agent that loads the right skill can use the shared tools immediately. No per-domain CRUD code required.

Example: a “expense tracker” skill documents tables like `expenses` and `categories`, the JSON Schema for each, how to log a purchase, and which aggregate answers “spend by month.” The skill does not implement storage; it teaches the agent how to drive **vellum-db**.

## What you can build on it

Anything that needs structured storage and/or aggregation, for example:

- Expense and budget tracking  
- Diet / nutrition logs  
- Birthdays and reminders  
- Price monitoring  
- Habit streaks, inventories, simple CRMs  

If the shape fits “rows in tables + filters + rollups,” a skill on top of this plugin is enough.

## How it works (agent view)

1. **Define tables** — JSON Schema → SQLite columns (`db_create_table`). Optional `scope` to group related tables.
2. **Write and change rows** — `db_insert`, `db_update`, `db_delete` with JSON filters.
3. **Read and analyze** — `db_query` (filter / order / page) and `db_aggregate` (count, sum, avg, min, max, group by).
4. **Reuse analysis** — `db_save_query` / `db_run_saved_query` with `$param` placeholders.
5. **Discover** — `db_list_tables` (and saved-query listing) with filters and pagination.
6. **Import / export** — `db_load` / `db_dump` (`csv`, `json`, `jsonl`, or Excel via `xls`).

Built-in skills:

| Skill | Load | Role |
| --- | --- | --- |
| `vellum-db` | `skill_load { "skill": "vellum-db" }` | Query, aggregate, row ops, saved queries, optional SQL escape hatch |
| `vellum-db-meta` | `skill_load { "skill": "vellum-db-meta" }` | Create / alter / drop tables |

Domain skills should depend on these: spell out table names, schemas, and procedures; call the shared `db_*` tools.

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

**When vellum-db fits better:** many domain skills should share one validated store; routine ops stay JSON (filters, aggregates, saved queries, import/export); persistence lives in-process via Bun’s SQLite in the Vellum runtime.

Browse more servers: [MCP Registry](https://registry.modelcontextprotocol.io/).

## Config

See `config.json` and [AGENTS.md](./AGENTS.md) for keys (`maxRowsPerQuery`, `rawSqlMode`, `databasePath`, `allowDropTable`) and layout for contributors.

## Develop

```bash
bun install
RUSTUP_TOOLCHAIN=stable bunx tsc --noEmit
RUSTUP_TOOLCHAIN=stable bun test
```

This repository root **is** the plugin (`hooks/`, `tools/`, `skills/`, `src/`).
