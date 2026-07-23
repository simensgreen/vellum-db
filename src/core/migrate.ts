import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { ApiError } from "../api/errors.ts"
import { type MigrationFile, MigrationFileSchema } from "../api/schemas/migrate.ts"
import { getConfig, getDatabase } from "../db.ts"
import {
    alterUserTable,
    buildKnownTablesMap,
    createUserTable,
    dropUserTable,
    getTable,
    parseTableDefinition
} from "./catalog.ts"
import { insertTableRow, parseOnConflict } from "./insert.ts"
import {
    canonicalMigrationJson,
    getMigrationByHash,
    hashMigrationBytes,
    hashMigrationContent,
    listMigrations,
    recordMigration,
    requireMigrationById
} from "./migrations-store.ts"
import { notifyInvalidation } from "./sync.ts"
import { invalidationTagsForCatalogChange, invalidationTagsForViewsChange } from "./sync-tags.ts"
import { assertTableDefinition } from "./table/index.ts"
import type { TableDefinition } from "./table/types.ts"
import { resolveIoPath } from "./table-io.ts"
import { deleteView, getView, saveView, type ViewKind } from "./views.ts"

export type MigrationOperationOutcome = {
    kind: string
    target: string
    outcome: "applied" | "skipped"
    detail?: string
}

export type ApplyMigrationResult = {
    outcome: "applied" | "already_applied"
    id: number
    hash: string
    name: string
    operations: MigrationOperationOutcome[]
}

type MigrationOperation =
    | { kind: "drop"; table: string }
    | {
          kind: "create"
          scope: string
          definition: TableDefinition
      }
    | {
          kind: "alter"
          table: string
          add?: Array<{
              name: string
              slug: string
              column: TableDefinition["columns"][number]
          }>
          drop?: string[]
          scope?: string | null
      }
    | {
          kind: "seed"
          table: string
          row: Record<string, unknown>
          on_conflict: "abort" | "ignore" | "replace"
      }
    | {
          kind: "view"
          slug: string
          name: string
          kindView: ViewKind
          definition: unknown
          description?: string
          scope: string
      }
    | { kind: "delete_view"; slug: string }

export function parseMigrationFile(raw: unknown): MigrationFile {
    return MigrationFileSchema.parse(raw)
}

export function compileMigrationPlan(migration: MigrationFile): MigrationOperation[] {
    const operations: MigrationOperation[] = []

    for (const tableName of migration.drop ?? []) {
        operations.push({ kind: "drop", table: tableName })
    }

    for (const entry of migration.create ?? []) {
        operations.push({
            kind: "create",
            scope: entry.scope,
            definition: entry.definition as TableDefinition
        })
    }

    for (const entry of migration.alter ?? []) {
        operations.push({
            kind: "alter",
            table: entry.table,
            add: entry.add?.map((addition) => ({
                name: addition.name,
                slug: addition.slug,
                column: addition.column as TableDefinition["columns"][number]
            })),
            drop: entry.drop,
            ...(Object.hasOwn(entry, "scope") ? { scope: entry.scope ?? null } : {})
        })
    }

    for (const seedBlock of migration.seed ?? []) {
        const onConflict = parseOnConflict(seedBlock.on_conflict ?? "ignore")
        for (const row of seedBlock.rows) {
            operations.push({
                kind: "seed",
                table: seedBlock.table,
                row,
                on_conflict: onConflict
            })
        }
    }

    for (const viewEntry of migration.views ?? []) {
        operations.push({
            kind: "view",
            slug: viewEntry.slug,
            name: viewEntry.name,
            kindView: viewEntry.kind,
            definition: viewEntry.definition,
            description: viewEntry.description,
            scope: viewEntry.scope
        })
    }

    for (const viewSlug of migration.delete_views ?? []) {
        operations.push({ kind: "delete_view", slug: viewSlug })
    }

    return operations
}

function filterAlterOperation(
    operation: Extract<MigrationOperation, { kind: "alter" }>
): Extract<MigrationOperation, { kind: "alter" }> | null {
    const table = getTable(operation.table)
    if (!table) {
        return null
    }
    const definition = parseTableDefinition(table)
    const existingSlugs = new Set(definition.columns.map((column) => column.slug))
    const filteredAdd = (operation.add ?? []).filter(
        (addition) => !existingSlugs.has(addition.slug)
    )
    const filteredDrop = (operation.drop ?? []).filter((dropSlug) => existingSlugs.has(dropSlug))
    const scopeProvided = Object.hasOwn(operation, "scope")
    if (filteredAdd.length === 0 && filteredDrop.length === 0 && !scopeProvided) {
        return null
    }
    return {
        kind: "alter",
        table: operation.table,
        add: filteredAdd.length > 0 ? filteredAdd : undefined,
        drop: filteredDrop.length > 0 ? filteredDrop : undefined,
        ...(scopeProvided ? { scope: operation.scope ?? null } : {})
    }
}

export function executeMigrationPlan(
    operations: MigrationOperation[]
): MigrationOperationOutcome[] {
    const outcomes: MigrationOperationOutcome[] = []
    const invalidatedTables = new Set<string>()
    let viewsChanged = false

    for (const operation of operations) {
        switch (operation.kind) {
            case "drop": {
                if (!getConfig().allowDropTable) {
                    throw new ApiError(
                        "forbidden",
                        "Table drop is disabled (config.allowDropTable = false)",
                        { status: 403 }
                    )
                }
                if (!getTable(operation.table)) {
                    outcomes.push({
                        kind: "drop",
                        target: operation.table,
                        outcome: "skipped",
                        detail: "table_not_found"
                    })
                    break
                }
                dropUserTable(operation.table)
                invalidatedTables.add(operation.table)
                outcomes.push({
                    kind: "drop",
                    target: operation.table,
                    outcome: "applied"
                })
                break
            }
            case "create": {
                if (getTable(operation.definition.slug)) {
                    outcomes.push({
                        kind: "create",
                        target: operation.definition.slug,
                        outcome: "skipped",
                        detail: "table_exists"
                    })
                    break
                }
                const knownTables = buildKnownTablesMap()
                const definition = assertTableDefinition(operation.definition, {
                    knownTables
                })
                createUserTable(definition, { scope: operation.scope })
                invalidatedTables.add(definition.slug)
                outcomes.push({
                    kind: "create",
                    target: definition.slug,
                    outcome: "applied"
                })
                break
            }
            case "alter": {
                const filtered = filterAlterOperation(operation)
                if (!filtered) {
                    outcomes.push({
                        kind: "alter",
                        target: operation.table,
                        outcome: "skipped",
                        detail: "no_changes"
                    })
                    break
                }
                alterUserTable({
                    table: filtered.table,
                    add: filtered.add,
                    drop: filtered.drop,
                    ...(Object.hasOwn(filtered, "scope") ? { scope: filtered.scope } : {})
                })
                invalidatedTables.add(filtered.table)
                outcomes.push({
                    kind: "alter",
                    target: filtered.table,
                    outcome: "applied"
                })
                break
            }
            case "seed": {
                const table = getTable(operation.table)
                if (!table) {
                    throw new ApiError(
                        "validation_error",
                        `Seed target table "${operation.table}" does not exist`
                    )
                }
                const result = insertTableRow(table, operation.row, operation.on_conflict)
                invalidatedTables.add(table.name)
                outcomes.push({
                    kind: "seed",
                    target: table.name,
                    outcome: result.outcome === "ignored" ? "skipped" : "applied",
                    detail: result.outcome
                })
                break
            }
            case "view": {
                saveView({
                    slug: operation.slug,
                    name: operation.name,
                    kind: operation.kindView,
                    definition: operation.definition,
                    description: operation.description,
                    scope: operation.scope
                })
                viewsChanged = true
                outcomes.push({
                    kind: "view",
                    target: operation.slug,
                    outcome: "applied"
                })
                break
            }
            case "delete_view": {
                if (!getView(operation.slug)) {
                    outcomes.push({
                        kind: "delete_view",
                        target: operation.slug,
                        outcome: "skipped",
                        detail: "view_not_found"
                    })
                    break
                }
                deleteView(operation.slug)
                viewsChanged = true
                outcomes.push({
                    kind: "delete_view",
                    target: operation.slug,
                    outcome: "applied"
                })
                break
            }
        }
    }

    for (const tableName of invalidatedTables) {
        notifyInvalidation(invalidationTagsForCatalogChange(tableName))
    }
    if (viewsChanged) {
        notifyInvalidation(invalidationTagsForViewsChange())
    }

    return outcomes
}

function applyMigrationContent(input: {
    hash: string
    name: string
    migrationJson: string
    migration: MigrationFile
}): ApplyMigrationResult {
    const existing = getMigrationByHash(input.hash)
    if (existing) {
        return {
            outcome: "already_applied",
            id: existing.id,
            hash: existing.hash,
            name: existing.name,
            operations: []
        }
    }

    const database = getDatabase()
    database.run("BEGIN")
    try {
        const operations = executeMigrationPlan(compileMigrationPlan(input.migration))
        const recorded = recordMigration(
            {
                hash: input.hash,
                name: input.name,
                migration_json: input.migrationJson
            },
            database
        )
        database.run("COMMIT")
        return {
            outcome: "applied",
            id: recorded.id,
            hash: recorded.hash,
            name: recorded.name,
            operations
        }
    } catch (error) {
        database.run("ROLLBACK")
        throw error
    }
}

export function applyMigration(input: {
    path?: string
    hash?: string
    id?: number
}): ApplyMigrationResult {
    if (input.path) {
        const resolvedPath = resolveIoPath(input.path)
        const bytes = readFileSync(resolvedPath)
        const migrationJson = bytes.toString("utf8")
        const migration = parseMigrationFile(JSON.parse(migrationJson))
        return applyMigrationContent({
            hash: hashMigrationBytes(bytes),
            name: basename(resolvedPath),
            migrationJson,
            migration
        })
    }

    if (input.hash) {
        const existing = getMigrationByHash(input.hash)
        if (existing) {
            return {
                outcome: "already_applied",
                id: existing.id,
                hash: existing.hash,
                name: existing.name,
                operations: []
            }
        }
        throw new ApiError("not_found", `Migration hash "${input.hash}" is not applied`, {
            hint: "Use path to apply a migration file"
        })
    }

    if (input.id !== undefined) {
        const existing = requireMigrationById(input.id)
        return {
            outcome: "already_applied",
            id: existing.id,
            hash: existing.hash,
            name: existing.name,
            operations: []
        }
    }

    throw new ApiError("validation_error", "Provide exactly one of path, hash, or id")
}

export function applyInlineMigration(input: {
    name: string
    migration: MigrationFile
}): ApplyMigrationResult {
    const migrationJson = canonicalMigrationJson(input.migration)
    const hash = hashMigrationContent(migrationJson)
    return applyMigrationContent({
        hash,
        name: input.name,
        migrationJson,
        migration: input.migration
    })
}

export function listMigrationsView(input: { limit?: number; offset?: number }) {
    return listMigrations(input)
}
