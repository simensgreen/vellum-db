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

function stripSqlLiterals(sqlText: string): string {
    let stripped = ""
    let index = 0
    while (index < sqlText.length) {
        const char = sqlText[index]
        if (char === "'") {
            index += 1
            while (index < sqlText.length) {
                if (sqlText[index] === "'" && sqlText[index + 1] === "'") {
                    index += 2
                    continue
                }
                if (sqlText[index] === "'") {
                    index += 1
                    break
                }
                index += 1
            }
            stripped += " "
            continue
        }
        if (char === '"') {
            index += 1
            while (index < sqlText.length) {
                if (sqlText[index] === '"' && sqlText[index + 1] === '"') {
                    index += 2
                    continue
                }
                if (sqlText[index] === '"') {
                    index += 1
                    break
                }
                index += 1
            }
            stripped += " "
            continue
        }
        stripped += char
        index += 1
    }
    return stripped
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

    const keywordScanTarget = stripSqlLiterals(trimmed)
    for (const keyword of FORBIDDEN) {
        if (new RegExp(`\\b${keyword}\\b`, "i").test(keywordScanTarget)) {
            throw new Error(`Forbidden keyword in raw SQL: ${keyword}`)
        }
    }

    return { sql: trimmed, isSelect: true }
}
