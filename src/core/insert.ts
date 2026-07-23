import { nanoid } from "nanoid"
import { asBindings } from "../bindings.ts"
import { getDatabase } from "../db.ts"
import { validateRowAgainstSchema } from "../schema-validate.ts"
import {
    encodeCellValue,
    getCompiledColumns,
    getTableColumns,
    parseTableDefinition,
    quoteIdentExport,
    type TableRow
} from "./catalog.ts"
import { primaryKeySlugs } from "./table/types.ts"

export type OnConflict = "abort" | "ignore" | "replace"

export type InsertOutcome = "inserted" | "ignored" | "replaced"

/** URL-safe nanoid alphabet; generated ids use the default nanoid() length (21). */
const ROWID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export const onConflictInputSchema = {
    type: "string",
    enum: ["abort", "ignore", "replace"],
    description:
        'Primary-key conflict policy: "abort" (default) fails, "ignore" skips, "replace" overwrites.'
} as const

export function createRowId(): string {
    return nanoid()
}

export function parseOnConflict(value: unknown): OnConflict {
    if (value === undefined) {
        return "abort"
    }
    if (value === "abort" || value === "ignore" || value === "replace") {
        return value
    }
    throw new Error('on_conflict must be "abort", "ignore", or "replace"')
}

export function parseOptionalRowId(raw: unknown): string | undefined {
    if (raw === undefined || raw === null || raw === "") {
        return undefined
    }
    if (typeof raw !== "string") {
        throw new Error("primary key value must be a string when provided")
    }
    const trimmed = raw.trim()
    if (!ROWID_PATTERN.test(trimmed)) {
        throw new Error("primary key string must match nanoid alphabet [A-Za-z0-9_-] (1-64 chars)")
    }
    return trimmed
}

function applyInsertDefaults(
    rowInput: Record<string, unknown>,
    table: TableRow
): Record<string, unknown> {
    const compiledColumns = getCompiledColumns(table)
    const row: Record<string, unknown> = { ...rowInput }

    for (const column of compiledColumns) {
        if (Object.hasOwn(row, column.slug)) {
            continue
        }
        if (column.insertDefault === "nanoid") {
            row[column.slug] = createRowId()
            continue
        }
        if (column.insertDefault === "now") {
            row[column.slug] = new Date().toISOString()
        }
    }

    return row
}

function buildPrimaryKeyWhere(
    tableName: string,
    primaryKeyValues: Record<string, unknown>
): { sql: string; values: unknown[] } {
    const entries = Object.entries(primaryKeyValues)
    const clauses = entries.map(([slug]) => `${quoteIdentExport(slug)} = ?`)
    return {
        sql: `SELECT 1 AS ok FROM ${quoteIdentExport(tableName)} WHERE ${clauses.join(" AND ")} LIMIT 1`,
        values: entries.map(([, value]) => value)
    }
}

function rowExists(tableName: string, primaryKeyValues: Record<string, unknown>): boolean {
    const query = buildPrimaryKeyWhere(tableName, primaryKeyValues)
    const found = getDatabase()
        .query(query.sql)
        .get(...asBindings(query.values))
    return found !== null && found !== undefined
}

function extractPrimaryKeyValues(
    row: Record<string, unknown>,
    primaryKeySlugs: string[]
): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const slug of primaryKeySlugs) {
        values[slug] = row[slug]
    }
    return values
}

function resolveResultId(primaryKeySlugs: string[], row: Record<string, unknown>): string {
    if (primaryKeySlugs.length === 1) {
        return String(row[primaryKeySlugs[0]!])
    }
    return primaryKeySlugs.map((slug) => String(row[slug])).join(":")
}

export function insertTableRow(
    table: TableRow,
    rowInput: Record<string, unknown>,
    onConflict: OnConflict = "abort"
): { id: string; changes: number; outcome: InsertOutcome } {
    const definition = parseTableDefinition(table)
    const primaryKeySlugsList = primaryKeySlugs(definition)
    const rowWithDefaults = applyInsertDefaults(rowInput, table)

    for (const pkSlug of primaryKeySlugsList) {
        if (rowWithDefaults[pkSlug] === undefined || rowWithDefaults[pkSlug] === null) {
            throw new Error(`Primary key column "${pkSlug}" is required`)
        }
    }

    validateRowAgainstSchema(table.name, table.schema_json, rowWithDefaults)

    const columns = getTableColumns(table)
    const columnNames = columns.map((column) => column.name)
    const values = columns.map((column) => encodeCellValue(rowWithDefaults[column.name], column))

    const primaryKeyValues = extractPrimaryKeyValues(rowWithDefaults, primaryKeySlugsList)
    const explicitPrimaryKey = primaryKeySlugsList.every((slug) => Object.hasOwn(rowInput, slug))

    const insertKeyword =
        onConflict === "ignore"
            ? "INSERT OR IGNORE"
            : onConflict === "replace"
              ? "INSERT OR REPLACE"
              : "INSERT"
    const placeholders = columnNames.map(() => "?").join(", ")
    const sqlText = `${insertKeyword} INTO ${quoteIdentExport(table.name)} (${columnNames
        .map((name) => quoteIdentExport(name))
        .join(", ")}) VALUES (${placeholders})`

    const existed =
        explicitPrimaryKey && (onConflict === "ignore" || onConflict === "replace")
            ? rowExists(table.name, primaryKeyValues)
            : false

    const result = getDatabase()
        .query(sqlText)
        .run(...asBindings(values))
    const resultId = resolveResultId(primaryKeySlugsList, rowWithDefaults)

    if (onConflict === "ignore" && result.changes === 0) {
        return {
            id: resultId,
            changes: 0,
            outcome: "ignored"
        }
    }
    if (onConflict === "replace" && existed) {
        return {
            id: resultId,
            changes: result.changes,
            outcome: "replaced"
        }
    }
    return {
        id: resultId,
        changes: result.changes,
        outcome: "inserted"
    }
}
