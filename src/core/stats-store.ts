import { databaseOnDiskBytes, getConfig, getDatabase, getDatabasePath } from "../db.ts"
import { addUtcEpochDays, utcEpochDay } from "../utc-epoch-day.ts"
import { listTables, quoteIdentExport } from "./catalog.ts"

export type StatsSnapshot = {
    table_count: number
    row_count: number
    database_bytes: number
}

export type StatsDelta = {
    inserts?: number
    updates?: number
    deletions?: number
    reads?: number
}

export type StatsRow = StatsSnapshot & {
    day: number
    inserts: number
    updates: number
    deletions: number
    reads: number
}

export function getStatsRetentionDays(): number {
    return getConfig().statsRetentionDays
}

export function isUserTableName(tableName: string): boolean {
    return !tableName.startsWith("_")
}

export function measureLiveSnapshot(): StatsSnapshot {
    const tablesPage = listTables({ limit: 10_000 })
    const database = getDatabase()
    let rowCount = 0

    for (const table of tablesPage.tables) {
        const countRow = database
            .query(`SELECT COUNT(*) AS count FROM ${quoteIdentExport(table.name)}`)
            .get() as { count: number }
        rowCount += countRow.count
    }

    return {
        table_count: tablesPage.total_count,
        row_count: rowCount,
        database_bytes: databaseOnDiskBytes(getDatabasePath())
    }
}

export function pruneStatsRetention(): void {
    const cutoffDay = addUtcEpochDays(utcEpochDay(), -getStatsRetentionDays())
    getDatabase().query("DELETE FROM _stats WHERE day < ?").run(cutoffDay)
}

export function recordStatsDelta(delta: StatsDelta = {}): void {
    const inserts = delta.inserts ?? 0
    const updates = delta.updates ?? 0
    const deletions = delta.deletions ?? 0
    const reads = delta.reads ?? 0

    if (inserts < 0 || updates < 0 || deletions < 0 || reads < 0) {
        throw new Error("stats delta counters must be non-negative")
    }

    const snapshot = measureLiveSnapshot()
    const today = utcEpochDay()

    getDatabase()
        .query(
            `INSERT INTO _stats (
        day, table_count, row_count, database_bytes,
        inserts, updates, deletions, reads
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET
        table_count = excluded.table_count,
        row_count = excluded.row_count,
        database_bytes = excluded.database_bytes,
        inserts = _stats.inserts + excluded.inserts,
        updates = _stats.updates + excluded.updates,
        deletions = _stats.deletions + excluded.deletions,
        reads = _stats.reads + excluded.reads`
        )
        .run(
            today,
            snapshot.table_count,
            snapshot.row_count,
            snapshot.database_bytes,
            inserts,
            updates,
            deletions,
            reads
        )

    pruneStatsRetention()
}

export function refreshStatsSnapshot(): void {
    recordStatsDelta({})
}

export function getStatsRowForDay(day: number): StatsRow | null {
    return (
        (getDatabase()
            .query(
                `SELECT day, table_count, row_count, database_bytes,
                inserts, updates, deletions, reads
         FROM _stats WHERE day = ?`
            )
            .get(day) as StatsRow | null) ?? null
    )
}

export function listStatsRows(fromDay: number, toDay: number): StatsRow[] {
    return getDatabase()
        .query(
            `SELECT day, table_count, row_count, database_bytes,
              inserts, updates, deletions, reads
       FROM _stats
       WHERE day >= ? AND day <= ?
       ORDER BY day ASC`
        )
        .all(fromDay, toDay) as StatsRow[]
}
