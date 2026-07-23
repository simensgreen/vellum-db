import { utcEpochDay, utcEpochDayToIso } from "../utc-epoch-day.ts"
import {
    getStatsRetentionDays,
    getStatsRowForDay,
    listStatsRows,
    measureLiveSnapshot,
    refreshStatsSnapshot,
    type StatsRow
} from "./stats-store.ts"

export type StatsGranularity = "day" | "week" | "month"

export type StatsBucket = {
    start: string
    inserts: number
    updates: number
    deletions: number
    reads: number
    total: number
    table_count: number
    row_count: number
    database_bytes: number
}

export type DatabaseStats = {
    summary: {
        table_count: number
        row_count: number
        database_bytes: number
    }
    retention_days: number
    granularity: StatsGranularity
    buckets: StatsBucket[]
}

function snapshotFromRow(
    row: StatsRow
): Omit<StatsBucket, "start" | "inserts" | "updates" | "deletions" | "reads" | "total"> {
    return {
        table_count: row.table_count,
        row_count: row.row_count,
        database_bytes: row.database_bytes
    }
}

function bucketStartForDay(day: number, granularity: StatsGranularity): string {
    if (granularity === "day") {
        return utcEpochDayToIso(day)
    }
    const utcDate = new Date(day * 86_400_000)
    if (granularity === "month") {
        const year = utcDate.getUTCFullYear()
        const month = String(utcDate.getUTCMonth() + 1).padStart(2, "0")
        return `${year}-${month}-01`
    }
    const dayOfWeek = utcDate.getUTCDay()
    const daysSinceMonday = (dayOfWeek + 6) % 7
    return utcEpochDayToIso(day - daysSinceMonday)
}

function defaultBucketLimit(granularity: StatsGranularity, retentionDays: number): number {
    if (granularity === "day") {
        return retentionDays
    }
    if (granularity === "week") {
        return Math.max(1, Math.ceil(retentionDays / 7))
    }
    return Math.max(1, Math.ceil(retentionDays / 30))
}

function daysPerBucket(granularity: StatsGranularity): number {
    if (granularity === "day") {
        return 1
    }
    if (granularity === "week") {
        return 7
    }
    return 30
}

function buildBucketStarts(
    endDay: number,
    granularity: StatsGranularity,
    bucketLimit: number,
    retentionDays: number
): string[] {
    const maxLookbackDays = Math.min(retentionDays, bucketLimit * daysPerBucket(granularity))
    const startDay = Math.max(0, endDay - maxLookbackDays + 1)
    const starts: string[] = []
    const seen = new Set<string>()

    for (let day = startDay; day <= endDay; day += 1) {
        const start = bucketStartForDay(day, granularity)
        if (!seen.has(start)) {
            seen.add(start)
            starts.push(start)
        }
    }

    while (starts.length > bucketLimit) {
        starts.shift()
    }

    return starts
}

function isoToEpochDay(isoDate: string): number {
    const [year, month, date] = isoDate.split("-").map(Number)
    return utcEpochDay(new Date(Date.UTC(year!, month! - 1, date!)))
}

function aggregateBuckets(
    rows: StatsRow[],
    bucketStarts: string[],
    granularity: StatsGranularity
): StatsBucket[] {
    const rowsByDay = new Map(rows.map((row) => [row.day, row]))
    const buckets: StatsBucket[] = []

    let lastSnapshot = {
        table_count: 0,
        row_count: 0,
        database_bytes: 0
    }

    for (const start of bucketStarts) {
        const bucketStartDay = isoToEpochDay(start)
        let endDay = bucketStartDay
        if (granularity === "day") {
            endDay = bucketStartDay
        } else if (granularity === "week") {
            endDay = bucketStartDay + 6
        } else {
            const utcDate = new Date(bucketStartDay * 86_400_000)
            const year = utcDate.getUTCFullYear()
            const month = utcDate.getUTCMonth()
            const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
            endDay = isoToEpochDay(
                `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
            )
        }

        let inserts = 0
        let updates = 0
        let deletions = 0
        let reads = 0
        let snapshotDay = -1
        let snapshotRow: StatsRow | null = null

        for (let day = bucketStartDay; day <= endDay; day += 1) {
            const row = rowsByDay.get(day)
            if (!row) {
                continue
            }
            inserts += row.inserts
            updates += row.updates
            deletions += row.deletions
            reads += row.reads
            if (day >= snapshotDay) {
                snapshotDay = day
                snapshotRow = row
            }
        }

        if (snapshotRow) {
            lastSnapshot = snapshotFromRow(snapshotRow)
        }

        buckets.push({
            start,
            inserts,
            updates,
            deletions,
            reads,
            total: inserts + updates + deletions + reads,
            ...lastSnapshot
        })
    }

    return buckets
}

function readSummary(): DatabaseStats["summary"] {
    const today = utcEpochDay()
    const todayRow = getStatsRowForDay(today)
    if (todayRow) {
        return {
            table_count: todayRow.table_count,
            row_count: todayRow.row_count,
            database_bytes: todayRow.database_bytes
        }
    }
    return measureLiveSnapshot()
}

export function getDatabaseStats(
    input: { granularity?: StatsGranularity; limit?: number } = {}
): DatabaseStats {
    const retentionDays = getStatsRetentionDays()
    const granularity = input.granularity ?? "day"
    const bucketLimit = Math.min(
        input.limit ?? defaultBucketLimit(granularity, retentionDays),
        defaultBucketLimit(granularity, retentionDays)
    )

    const today = utcEpochDay()
    if (!getStatsRowForDay(today)) {
        refreshStatsSnapshot()
    }

    const bucketStarts = buildBucketStarts(today, granularity, bucketLimit, retentionDays)
    const earliestDay = bucketStarts.length > 0 ? isoToEpochDay(bucketStarts[0]!) : today
    const rows = listStatsRows(earliestDay, today)

    return {
        summary: readSummary(),
        retention_days: retentionDays,
        granularity,
        buckets: aggregateBuckets(rows, bucketStarts, granularity)
    }
}
