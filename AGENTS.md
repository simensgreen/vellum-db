# vellum-db

Vellum plugin: structured storage for agents (TableDefinition DSL tables, JSON query/aggregate, named views).

## Scope

This repository root **is** the plugin (`package.json` + `hooks/` + `tools/` + `skills/` + `src/` + `routes/` + `apps/` + `config.json`). Layout follows the [plugin-builder](https://github.com/vellum-ai/vellum-assistant) convention (`<workspace>/plugins/vellum-db/`).

## Stack

| Piece | Choice |
| --- | --- |
| DB | `bun:sqlite` (Vellum Bun runtime); file under `pluginStorageDir` (`<pluginDir>/data/` for user plugins) |
| Validation | Ajv (table schemas + rows + tool inputs) |
| Filters | `@truto/sqlite-builder` (`compileFilter`) |
| File IO | `db_load` / `db_dump` (`csv` \| `json` \| `jsonl` \| `xlsx` via SheetJS `xlsx`) |
| Tables app | Preact (`apps/tables/`) |
| Lint / format | Biome (`biome.json`; `bun run lint`) |
| Runtime | **Bun** `>=1.2.0` only (`engines.bun` in `package.json`; Vellum host; `bun:sqlite`, `bun test`) — not Node |
| Plugin contract | `@vellumai/plugin-api` peer `^0.8.0` (also `devDependency` for local `tsc`) |

## Layout

| Path | Role |
| --- | --- |
| `package.json` | Manifest: `name`, `version`, `peerDependencies["@vellumai/plugin-api"]`, `vellum: {}` |
| `biome.json` | Lint + format config (Biome) |
| `config.json` | User-editable config (host-preserved across upgrades) |
| `data/` | Runtime DB (host-created; gitignored) — `InitContext.pluginStorageDir` |
| `hooks/init.ts` | Open `bun:sqlite`, pragmas, meta DDL (idempotent) |
| `hooks/shutdown.ts` | Close DB |
| `tools/db_*.ts` | Always-on model tools (`ToolDefinition` → `src/core/`) |
| `routes/` | REST API at `/v1/x/plugins/vellum-db/...` → `src/core/` |
| `src/api/` | Zod request schemas + `parse-request.ts` (shared by routes and OpenAPI) |
| `src/openapi/` | `@asteasolutions/zod-to-openapi` registry → `openapi.json` |
| `openapi.json` | Generated REST spec (commit after route changes) |
| `apps/tables/` | Database app UI (`plugins~vellum-db~tables`; display name **Database**) |
| `src/core/` | Domain logic shared by tools and routes |
| `src/core/sync-tags.ts` | Invalidation tag constants + builders (canonical) |
| `skills/vellum-db/` | Query/analyze procedures + `references/` |
| `skills/vellum-db-meta/` | Migration authoring (`db_migrate`, `db_list_migrations`) |
| `examples/expenses/` | Sample domain skill (expense tracker); **not** indexed by Vellum — copy to workspace `skills/` to activate; JSON schemas in `examples/expenses/schemas/` |
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
| `allowDropTable` | `false` (default) — migration/API `drop` rejects; `true` — allow DROP TABLE + delete `_tables` row |
| `statsRetentionDays` | Days of `_stats` daily history to keep (UTC epoch days). Default **30** when omitted. |

Meta table **`_stats`** (one row per UTC day): snapshots (`table_count`, `row_count`, `database_bytes`) plus daily op counters (`inserts`, `updates`, `deletions`, `reads`). Updated from `src/core/stats-store.ts` on row ops and DDL. Overview UI reads **`GET /stats`** (`granularity`: `day` \| `week` \| `month`).

## Commands

```bash
bun install
bun run lint          # Biome: format + lint (errors fail)
bun run lint:fix      # auto-fix safe + organize imports
bun run format        # format only
bun run typecheck     # tsc root + apps/tables
bun run check         # lint + typecheck + test (CI parity)
bunx tsc --noEmit
bunx tsc --noEmit -p apps/tables
bun test
bun run openapi   # manual regen; pre-commit does this for API changes
bun run dev:app   # Tables app UI: http://localhost:5173 (temp SQLite + route proxy)
```

`bun run dev:app` serves the Database app with hot reload, mock `window.vellum.fetch`, and the same REST handlers as production (`/v1/x/plugins/vellum-db/...`). Card preview UI: `http://localhost:5173/?preview=1`.

`bun install` sets local `core.hooksPath` to `.githooks`. Pre-commit runs Biome on staged source files and regenerates `openapi.json` when the commit includes changes under `routes/`, `src/api/`, or `src/openapi/`.

## Always

- TypeScript: prefer optional fields (`field?: T`) and `undefined` for absence; absorb JSON/SQL `null` at parse boundaries only.
- Persist only under plugin `data/` (`pluginStorageDir` from `init`).
- Validate table definitions and rows with Ajv (`src/core/table/` DSL + compiled row schemas).
- Prefer JSON tools over `db_sql` for routine work.
- Tool `input_schema` MUST NOT set `additionalProperties: false` at the tool-input root (or anywhere that rejects host-injected fields). Vellum injects `activity` into tool calls; rejecting unknown properties breaks every invocation.
- Paginated list/query responses return `page_count`, `total_count`, `limit`, `offset`, `has_more` (`page_count` = rows in this page; `total_count` = full match set).
- Optional table or view `scope` (`[a-z][a-z0-9_]*`) filters `db_list_tables` / `db_list_views`; **required** on create (migration `create[]` / `views[]`, `POST /tables?scope=`, save view query). List filter: omit `scope` = all; `scope: null` (tool) or `?scope=` empty (REST) = unscoped only.
- **Slug vs name:** `slug` is the identifier everywhere (API paths, DB lookups, tools, joins, filters). `name` is UI display text only (TableDefinition/view display name). REST list tables returns `slug`; filter by `slug_prefix`. `_tables.name` column stores table slug (SQLite legacy column name).
- View query definitions support ref joins (`left`/`inner`/`right`, multi-hop) on `kind: query` and `kind: aggregate`; see `skills/vellum-db/references/view-query-model.md`.
- `db_load` / `db_dump`: relative `path` under the Vellum workspace; `mode` is `csv` | `json` | `jsonl` | `xlsx`.
- REST file IO (Database app): `GET /export?table=&mode=` (download); `POST /import?table=&filename=` (raw body; format from filename or `mode` query).
- REST batch row commit (Database app): `POST /rows/commit?table=` body `{ insert?, update?, delete? }`.
- Schema changes via **flat migration JSON** (`db_migrate { path }`) or REST (`POST /migrate`, `GET /migrations`). Each REST DDL/view mutation records a migration in `_migrations`. Skill convention: `migrate.up.json` + `migrate.down.json`. See `skills/vellum-db-meta/references/migration-format.md`.
- Create tables with **TableDefinition DSL** in migration `create[]` or `POST /tables`. Canonical blob: `_tables.definition_json`; `schema_json` is compiled row validator cache.
- Table `primaryKey` on columns replaces table-level `pk` and implicit `id`: set `primaryKey: true` on one or more columns (e.g. `nanoid` + `default: "random"`).
- `db_insert` / `db_load` support `on_conflict`: `abort` | `ignore` | `replace` — conflict on primary key columns only.
- **Core** owns mutation invalidation via `src/core/sync.ts` + `src/core/sync-tags.ts` (not routes, not tools).
- Vellum app bundler rejects imports outside `apps/<name>/` (`validateImportPaths` in vellum-assistant `app-compiler.ts`). Mirror `src/core/sync-tags.ts` byte-identical to `apps/tables/src/sync-tags.ts`; `tests/sync-tags-parity.test.ts` enforces this.
- Database app display name is **Database** (UI title/header only; app id stays `plugins~vellum-db~tables`). Use host `--v-*` tokens and `.v-*` classes; layout-only CSS in `apps/tables/src/styles.css`. Vendored sandbox CSS: `apps/tables/vendor/vellum-design-system.css`; Figma palette bridge: `apps/tables/src/vellum-theme-bridge.css` (matches `@vellumai/design-library` tokens).
- Library card preview: detect via `isCardPreview()` (`window.vellum` without `fetch`); render static `CardPreview` — no API calls in card mode.
- REST reads: query params (JSON fields URL-encoded). REST mutations: table or view **slug** in query, payload in JSON body.
- REST errors: `{ type, msg?, hint? }`; `403` for config-gated features; `500` for internal errors.
- REST validation: `src/api/schemas/` + `parseRouteQuery` / `parseRouteBody`; OpenAPI imports the same schemas.
- Edit request schemas in `src/api/schemas/`; pre-commit refreshes `openapi.json` (or run `bun run openapi` manually).

## Never

- Edit the plan file under `.cursor/plans/` as part of implementation.
- Allow user table names starting with `_` (reserved for meta).
- Accept multi-statement raw SQL in `db_sql` (no semicolons). In `select-only` mode, also reject non-SELECT.
- Put durable state outside `data/` / `pluginStorageDir`.
- Cross-import between `tools/` and `routes/` (both call `src/core/` only).
- Commit `apps/**/dist/` (watcher-generated).
- Commit `apps/**/.dev/` (local dev harness output).

## Dependencies (host does not install them)

See prior note: run `bun install` inside the plugin dir after `assistant plugins install`. Prefer long-term vendor/zero-deps; pragmatic path is post-install `bun install`.
