import type { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { ApiError } from "../api/errors.ts"
import { getDatabase } from "../db.ts"
import { pageFromRows, resolvePage } from "../pagination.ts"

export type MigrationRow = {
    id: number
    hash: string
    name: string
    migration_json: string
    applied_at: string
}

const MIGRATION_ROW_SELECT = "SELECT id, hash, name, migration_json, applied_at FROM _migrations"

function nowIso(): string {
    return new Date().toISOString()
}

export function hashMigrationContent(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex")
}

export function hashMigrationBytes(bytes: Buffer | Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex")
}

export function canonicalMigrationJson(value: unknown): string {
    return JSON.stringify(sortJsonValue(value))
}

function sortJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => sortJsonValue(item))
    }
    if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>
        const sortedKeys = Object.keys(record).sort()
        const sorted: Record<string, unknown> = {}
        for (const key of sortedKeys) {
            sorted[key] = sortJsonValue(record[key])
        }
        return sorted
    }
    return value
}

export function getMigrationByHash(
    hash: string,
    database: Database = getDatabase()
): MigrationRow | null {
    return (
        database
            .query<MigrationRow, [string]>(`${MIGRATION_ROW_SELECT} WHERE hash = ?`)
            .get(hash) ?? null
    )
}

export function getMigrationById(
    id: number,
    database: Database = getDatabase()
): MigrationRow | null {
    return (
        database.query<MigrationRow, [number]>(`${MIGRATION_ROW_SELECT} WHERE id = ?`).get(id) ??
        null
    )
}

export function recordMigration(
    input: { hash: string; name: string; migration_json: string },
    database: Database = getDatabase()
): MigrationRow {
    const timestamp = nowIso()
    const insert = database.query<
        { lastInsertRowid: number | bigint },
        [string, string, string, string]
    >("INSERT INTO _migrations (hash, name, migration_json, applied_at) VALUES (?, ?, ?, ?)")
    const result = insert.run(input.hash, input.name, input.migration_json, timestamp)
    const id = Number(result.lastInsertRowid)
    return {
        id,
        hash: input.hash,
        name: input.name,
        migration_json: input.migration_json,
        applied_at: timestamp
    }
}

export function listMigrations(input: { limit?: number; offset?: number } = {}): {
    migrations: Array<{
        id: number
        hash: string
        name: string
        applied_at: string
    }>
    count: number
    limit: number
    offset: number
    has_more: boolean
} {
    const database = getDatabase()
    const { limit, offset } = resolvePage(input.limit, input.offset)
    const rows = database
        .query<Pick<MigrationRow, "id" | "hash" | "name" | "applied_at">, [number, number]>(
            "SELECT id, hash, name, applied_at FROM _migrations ORDER BY id DESC LIMIT ? OFFSET ?"
        )
        .all(limit + 1, offset)
    const page = pageFromRows(rows, limit, offset)
    return {
        migrations: page.items,
        count: page.count,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more
    }
}

export function requireMigrationByHash(hash: string): MigrationRow {
    const row = getMigrationByHash(hash)
    if (!row) {
        throw new ApiError("not_found", `Migration hash "${hash}" is not applied`, {
            hint: "Apply the migration file first or check db_list_migrations"
        })
    }
    return row
}

export function requireMigrationById(id: number): MigrationRow {
    const row = getMigrationById(id)
    if (!row) {
        throw new ApiError("not_found", `Migration id ${id} is not applied`, {
            hint: "Check db_list_migrations for valid ids"
        })
    }
    return row
}
