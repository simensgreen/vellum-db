import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

let database: Database | null = null;
let storageDir: string | null = null;
let workspaceDir: string | null = null;
let resolvedDatabasePath: string | null = null;

export type PluginConfig = {
  maxRowsPerQuery: number;
  rawSqlMode: "select-only" | "off" | "on";
  /** Relative to pluginStorageDir, or absolute. Omit for data/vellum-db.sqlite */
  databasePath: string | null;
  allowDropTable: boolean;
};

const DEFAULT_CONFIG: PluginConfig = {
  maxRowsPerQuery: 500,
  rawSqlMode: "select-only",
  databasePath: null,
  allowDropTable: false,
};

let pluginConfig: PluginConfig = { ...DEFAULT_CONFIG };

export function parseConfig(raw: unknown): PluginConfig {
  const source =
    raw !== null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};
  const maxRowsPerQuery =
    typeof source.maxRowsPerQuery === "number" &&
    Number.isFinite(source.maxRowsPerQuery) &&
    source.maxRowsPerQuery > 0
      ? Math.floor(source.maxRowsPerQuery)
      : DEFAULT_CONFIG.maxRowsPerQuery;
  const rawSqlMode =
    source.rawSqlMode === "off" ||
    source.rawSqlMode === "select-only" ||
    source.rawSqlMode === "on"
      ? source.rawSqlMode
      : DEFAULT_CONFIG.rawSqlMode;
  let databasePath: string | null = DEFAULT_CONFIG.databasePath;
  if (typeof source.databasePath === "string") {
    const trimmed = source.databasePath.trim();
    if (trimmed.length === 0) {
      throw new Error("config.databasePath must be non-empty when set");
    }
    databasePath = trimmed;
  } else if (source.databasePath !== undefined && source.databasePath !== null) {
    throw new Error("config.databasePath must be a string or null");
  }
  const allowDropTable =
    typeof source.allowDropTable === "boolean"
      ? source.allowDropTable
      : DEFAULT_CONFIG.allowDropTable;
  return { maxRowsPerQuery, rawSqlMode, databasePath, allowDropTable };
}

export function resolveDatabasePath(
  pluginStorageDir: string,
  config: PluginConfig,
): string {
  if (!config.databasePath) {
    return join(pluginStorageDir, "vellum-db.sqlite");
  }
  if (isAbsolute(config.databasePath)) {
    return config.databasePath;
  }
  return resolve(pluginStorageDir, config.databasePath);
}

/**
 * Derive the Vellum workspace root from pluginStorageDir when
 * `VELLUM_WORKSPACE_DIR` is unset.
 * - `<workspace>/plugins/<name>/data` (user plugins)
 * - `<workspace>/plugins-data/<name>` (legacy / first-party layout)
 * - otherwise treat pluginStorageDir itself as the workspace (tests)
 */
export function resolveWorkspaceDir(pluginStorageDir: string): string {
  const fromEnv = process.env.VELLUM_WORKSPACE_DIR?.trim();
  if (fromEnv) {
    return resolve(fromEnv);
  }
  const normalized = resolve(pluginStorageDir);
  if (basename(normalized) === "data") {
    return resolve(normalized, "../../..");
  }
  if (basename(dirname(normalized)) === "plugins-data") {
    return resolve(normalized, "../..");
  }
  return normalized;
}

export function openDatabase(
  pluginStorageDir: string,
  config: PluginConfig,
  options: { workspaceDir?: string } = {},
): Database {
  if (database) {
    return database;
  }
  storageDir = pluginStorageDir;
  workspaceDir = options.workspaceDir
    ? resolve(options.workspaceDir)
    : resolveWorkspaceDir(pluginStorageDir);
  pluginConfig = config;
  const databasePath = resolveDatabasePath(pluginStorageDir, config);
  mkdirSync(dirname(databasePath), { recursive: true });
  resolvedDatabasePath = databasePath;
  database = new Database(databasePath, { create: true });
  database.run("PRAGMA journal_mode = WAL;");
  database.run("PRAGMA foreign_keys = ON;");
  return database;
}

export function getDatabase(): Database {
  if (!database) {
    throw new Error("vellum-db: database is not open; init hook must run first");
  }
  return database;
}

export function getConfig(): PluginConfig {
  return pluginConfig;
}

export function getStorageDir(): string {
  if (!storageDir) {
    throw new Error("vellum-db: storage dir is not set");
  }
  return storageDir;
}

export function getWorkspaceDir(): string {
  if (!workspaceDir) {
    throw new Error("vellum-db: workspace dir is not set");
  }
  return workspaceDir;
}

export function getDatabasePath(): string {
  if (!resolvedDatabasePath) {
    throw new Error("vellum-db: database path is not set");
  }
  return resolvedDatabasePath;
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
  storageDir = null;
  workspaceDir = null;
  resolvedDatabasePath = null;
}
