import { getConfig } from "./db.ts"

const FORBIDDEN = [
    "ATTACH",
    "DETACH",
    "PRAGMA",
    "VACUUM",
    "REINDEX",
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "REPLACE",
    "TRUNCATE"
] as const

export type GuardedSql = {
    sql: string
    isSelect: boolean
}

function isSelectStatement(sqlText: string): boolean {
    const upper = sqlText.trimStart().toUpperCase()
    return upper.startsWith("SELECT") || upper.startsWith("WITH")
}

export function guardRawSql(sqlText: string): GuardedSql {
    const mode = getConfig().rawSqlMode
    if (mode === "off") {
        throw new Error("raw SQL is disabled (config.rawSqlMode = off)")
    }

    const trimmed = sqlText.trim()
    if (trimmed.length === 0) {
        throw new Error("SQL must be non-empty")
    }
    if (trimmed.includes(";")) {
        throw new Error("Only a single SQL statement is allowed (no semicolons)")
    }

    if (mode === "on") {
        return { sql: trimmed, isSelect: isSelectStatement(trimmed) }
    }

    if (!isSelectStatement(trimmed)) {
        throw new Error("Only SELECT (or WITH ... SELECT) statements are allowed")
    }

    for (const keyword of FORBIDDEN) {
        if (new RegExp(`\\b${keyword}\\b`, "i").test(trimmed)) {
            throw new Error(`Forbidden keyword in raw SQL: ${keyword}`)
        }
    }

    return { sql: trimmed, isSelect: true }
}
