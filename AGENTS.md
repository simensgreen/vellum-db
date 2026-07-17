# vellum-db

Vellum plugin: structured storage for agents (JSON Schema tables, JSON query/aggregate, named saved queries).

## Scope

This repository root **is** the plugin (`package.json` + `hooks/` + `tools/` + `skills/` + `src/` + `config.json`). Layout follows the [plugin-builder](https://github.com/vellum-ai/vellum-assistant) convention (`<workspace>/plugins/vellum-db/`).

## Stack

| Piece | Choice |
| --- | --- |
| DB | `bun:sqlite` (Vellum Bun runtime); file under `pluginStorageDir` (`<pluginDir>/data/` for user plugins) |
| Validation | Ajv (table schemas + rows + tool inputs) |
| Filters | `@truto/sqlite-builder` (`compileFilter`) |
| File IO | `db_load` / `db_dump` (`csv` \| `json` \| `jsonl` \| `xls` via SheetJS `xlsx`) |
| Plugin contract | `@vellumai/plugin-api` peer `^0.8.0` (also `devDependency` for local `tsc`) |

## Layout

| Path | Role |
| --- | --- |
| `package.json` | Manifest: `name`, `version`, `peerDependencies["@vellumai/plugin-api"]`, `vellum: {}` |
| `config.json` | User-editable config (host-preserved across upgrades) |
| `data/` | Runtime DB (host-created; gitignored) — `InitContext.pluginStorageDir` |
| `hooks/init.ts` | Open `bun:sqlite`, pragmas, meta DDL (idempotent) |
| `hooks/shutdown.ts` | Close DB |
| `tools/db_*.ts` | Always-on model tools (`ToolDefinition`: `description`, `input_schema`, `defaultRiskLevel`, `category`, `execute(input, ctx)`) |
| `skills/vellum-db/` | Query/analyze procedures + `references/` — `skill_load { skill: "vellum-db" }` |
| `skills/vellum-db-meta/` | Create/alter/drop procedures — `skill_load { skill: "vellum-db-meta" }` |
| `src/` | Shared modules (not walked by the loader) |
| `tests/` | Bun tests (`bun test`) |

### Why `tools/` and not skill `TOOLS.json`

Plugin-builder prefers skill-scoped tools to avoid always-on catalog weight. Skill executors run in a **sandbox** (stdlib only, no imports outside the skill dir, no shared state with hooks). This plugin opens SQLite in `init` and shares that connection via `src/` — that only works with in-process `tools/*.ts`. Domain skills still gate *when* to call tools via `skill_load` + procedure text.

Data is **workspace-global** (not per-conversation), so there is no `conversation-deleted` purge hook.

## config.json

| Key | Meaning |
| --- | --- |
| `maxRowsPerQuery` | Cap for query/aggregate/`db_sql` result rows |
| `rawSqlMode` | `select-only` — guarded SELECT only; `on` — any single statement; `off` — `db_sql` disabled |
| `databasePath` | `null`/omit → `pluginStorageDir/vellum-db.sqlite`; relative → under `pluginStorageDir`; absolute → that file |
| `allowDropTable` | `false` (default) — `db_drop_table` rejects; `true` — allow DROP TABLE + delete `_tables` row |

## Commands

```bash
bun install
bunx tsc --noEmit
```

Smoke test (no Vellum host required):

```bash
bun test
```

## Always

- Persist only under plugin `data/` (`pluginStorageDir` from `init`).
- Validate agent table schemas and rows with Ajv.
- Prefer JSON tools over `db_sql` for routine work.
- Tool `input_schema` MUST NOT set `additionalProperties: false` at the tool-input root (or anywhere that rejects host-injected fields). Vellum injects `activity` into tool calls; rejecting unknown properties breaks every invocation.
- List tools that can return many rows (`db_list_tables`, `db_list_saved_queries`, `db_query`, `db_aggregate`) use `limit`/`offset` and return `has_more`.
- Optional table `scope` (`[a-z][a-z0-9_]*`) filters `db_list_tables`; set on create/alter.
- `db_load` / `db_dump`: relative `path` under the Vellum workspace (`VELLUM_WORKSPACE_DIR` when set, else derived from `pluginStorageDir`); paths must stay inside the workspace. Dump includes `id`. Load may include `id` for `on_conflict`.
- `db_insert` / `db_load` support `on_conflict`: `abort` (default) \| `ignore` \| `replace` — conflict is on primary key `id` (nanoid TEXT) only.
- Row `id` is a nanoid string (`TEXT PRIMARY KEY`), generated on insert when omitted.
- Tool `execute` signatures take `(input, ctx: ToolContext)` and return `Promise<ToolExecutionResult>`.

## Dependencies (host does not install them)

Vellum **never** runs `bun install` for plugins (`ensure-shared-dep-links.ts`). Bare imports resolve by walking up to `<workspace>/node_modules`; the host only symlinks a **whitelist** of shared deps (currently `zod`) from the assistant into that tree. `@vellumai/plugin-api` is shimmed separately.

Runtime deps of this plugin (`@truto/sqlite-builder`, `ajv`, `nanoid`, `xlsx`) are **not** on that whitelist. Options:

1. **Ship `node_modules` with the plugin** — install materializes the tree verbatim; fingerprinting excludes `node_modules`. Heaviest artifact.
2. **Post-install step for operators** — after `assistant plugins install`, run `bun install` inside `plugins/vellum-db/` (document in README). Not automatic.
3. **Vendor / inline** — copy or rewrite small deps (`nanoid`); drop or replace heavier ones (`xlsx`, Ajv, sqlite-builder) with Bun-stdlib or in-repo code so the plugin has zero runtime `dependencies`.
4. **Do not rely on expanding the host whitelist** — that list is treated as public SDK surface and only pure-JS assistant deps belong there.

Prefer (3) long-term; (2) is the pragmatic local-dev path today.

## Never

- Edit the plan file under `.cursor/plans/` as part of implementation.
- Allow user table names starting with `_` (reserved for meta).
- Accept multi-statement raw SQL in `db_sql` (no semicolons). In `select-only` mode, also reject non-SELECT.
- Put durable state outside `data/` / `pluginStorageDir`.
- Move DB tools into skill `TOOLS.json` without a design that re-opens SQLite without shared `src/` (sandbox forbids it).
