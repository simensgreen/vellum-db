import { Database } from "bun:sqlite"
import { existsSync, mkdirSync, statSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"

let database: Database | undefined
let storageDir: string | undefined
let workspaceDir: string | undefined
let resolvedDatabasePath: string | undefined

export type PluginConfig = {
    maxRowsPerQuery: number
    rawSqlMode: "select-only" | "off" | "on"
    allowDropTable: boolean
    /** Days of _stats history to keep (UTC calendar days). */
    statsRetentionDays: number
}

const DEFAULT_CONFIG: PluginConfig = {
    maxRowsPerQuery: 500,
    rawSqlMode: "select-only",
    allowDropTable: false,
    statsRetentionDays: 30
}

let pluginConfig: PluginConfig = { ...DEFAULT_CONFIG }

export function parseConfig(raw: unknown): PluginConfig {
    const source = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    const maxRowsPerQuery =
        typeof source.maxRowsPerQuery === "number" &&
        Number.isFinite(source.maxRowsPerQuery) &&
        source.maxRowsPerQuery > 0
            ? Math.floor(source.maxRowsPerQuery)
            : DEFAULT_CONFIG.maxRowsPerQuery
    const rawSqlMode =
        source.rawSqlMode === "off" ||
        source.rawSqlMode === "select-only" ||
        source.rawSqlMode === "on"
            ? source.rawSqlMode
            : DEFAULT_CONFIG.rawSqlMode
    const allowDropTable =
        typeof source.allowDropTable === "boolean"
            ? source.allowDropTable
            : DEFAULT_CONFIG.allowDropTable
    const statsRetentionDays =
        typeof source.statsRetentionDays === "number" &&
        Number.isFinite(source.statsRetentionDays) &&
        source.statsRetentionDays >= 1
            ? Math.floor(source.statsRetentionDays)
            : DEFAULT_CONFIG.statsRetentionDays
    return {
        maxRowsPerQuery,
        rawSqlMode,
        allowDropTable,
        statsRetentionDays
    }
}

const DATABASE_FILE_NAME = "vellum-db.sqlite"
const DEFAULT_BUSY_TIMEOUT_MS = 5_000

export function databaseFilePath(pluginStorageDir: string): string {
    return join(pluginStorageDir, DATABASE_FILE_NAME)
}

/** On-disk size of the SQLite database file. */
export function databaseOnDiskBytes(sqlitePath: string): number {
    if (!existsSync(sqlitePath)) {
        return 0
    }
    return statSync(sqlitePath).size
}

function applyDatabasePragmas(database: Database): void {
    database.run(`PRAGMA busy_timeout = ${DEFAULT_BUSY_TIMEOUT_MS}`)
    database.run("PRAGMA journal_mode = DELETE")
    database.run("PRAGMA foreign_keys = ON")
}

/**
 * Derive the Vellum workspace root from pluginStorageDir when
 * `VELLUM_WORKSPACE_DIR` is unset.
 * - `<workspace>/plugins/<name>/data` (user plugins)
 * - `<workspace>/plugins-data/<name>` (legacy / first-party layout)
 * - otherwise treat pluginStorageDir itself as the workspace (tests)
 */
export function resolveWorkspaceDir(pluginStorageDir: string): string {
    const fromEnv = process.env.VELLUM_WORKSPACE_DIR?.trim()
    if (fromEnv) {
        return resolve(fromEnv)
    }
    const normalized = resolve(pluginStorageDir)
    if (basename(normalized) === "data") {
        return resolve(normalized, "../../..")
    }
    if (basename(dirname(normalized)) === "plugins-data") {
        return resolve(normalized, "../..")
    }
    return normalized
}

export function openDatabase(
    pluginStorageDir: string,
    config: PluginConfig,
    options: { workspaceDir?: string } = {}
): Database {
    if (database) {
        return database
    }
    storageDir = pluginStorageDir
    workspaceDir = options.workspaceDir
        ? resolve(options.workspaceDir)
        : resolveWorkspaceDir(pluginStorageDir)
    pluginConfig = config
    const sqlitePath = databaseFilePath(pluginStorageDir)
    mkdirSync(dirname(sqlitePath), { recursive: true })
    resolvedDatabasePath = sqlitePath
    database = new Database(sqlitePath, { create: true })
    applyDatabasePragmas(database)
    return database
}

export function getDatabase(): Database {
    if (!database) {
        throw new Error("vellum-db: database is not open; init hook must run first")
    }
    return database
}

export function getConfig(): PluginConfig {
    return pluginConfig
}

export function getStorageDir(): string {
    if (!storageDir) {
        throw new Error("vellum-db: storage dir is not set")
    }
    return storageDir
}

export function getWorkspaceDir(): string {
    if (!workspaceDir) {
        throw new Error("vellum-db: workspace dir is not set")
    }
    return workspaceDir
}

export function getDatabasePath(): string {
    if (!resolvedDatabasePath) {
        throw new Error("vellum-db: database path is not set")
    }
    return resolvedDatabasePath
}

export function closeDatabase(): void {
    if (database) {
        try {
            database.close()
        } catch {
            // Ignore double-close or handles invalidated by test cleanup.
        }
        database = undefined
    }
    storageDir = undefined
    workspaceDir = undefined
    resolvedDatabasePath = undefined
}
