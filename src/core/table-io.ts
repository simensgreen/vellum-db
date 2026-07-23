import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import * as XLSX from "xlsx"
import { getDatabase, getWorkspaceDir } from "../db.ts"
import { assertTableJsonSchema, type JsonSchemaObject } from "../schema-validate.ts"
import {
    type ColumnSpec,
    coerceCellValue,
    decodeRow,
    getTableColumns,
    parseTableDefinition,
    quoteIdentExport,
    requireTable,
    type TableRow
} from "./catalog.ts"
import { insertTableRow, type OnConflict, parseOnConflict } from "./insert.ts"
import { isUserTableName, recordStatsDelta } from "./stats-store.ts"
import { notifyInvalidation } from "./sync.ts"
import { invalidationTagsForRowMutation } from "./sync-tags.ts"
import { primaryKeyColumnSet, primaryKeySlugs } from "./table/types.ts"

export type IoMode = "csv" | "json" | "jsonl" | "xlsx"

export function ioModeFromFilename(filename: string): IoMode {
    const trimmed = filename.trim()
    const dotIndex = trimmed.lastIndexOf(".")
    if (dotIndex === -1 || dotIndex === trimmed.length - 1) {
        throw new Error(`Cannot detect format from filename: ${filename}`)
    }
    const extension = trimmed.slice(dotIndex + 1).toLowerCase()
    switch (extension) {
        case "csv":
            return "csv"
        case "json":
            return "json"
        case "jsonl":
        case "ndjson":
            return "jsonl"
        case "xlsx":
        case "xls":
            return "xlsx"
        default:
            throw new Error(
                `Unsupported file extension ".${extension}" (expected csv, json, jsonl, or xlsx)`
            )
    }
}

function assertInsideWorkspace(resolvedPath: string): string {
    const workspace = getWorkspaceDir()
    const relativePath = relative(workspace, resolvedPath)
    if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
        return resolvedPath
    }
    throw new Error(`path must stay within the workspace (${workspace})`)
}

export function resolveIoPath(pathInput: string): string {
    if (typeof pathInput !== "string" || pathInput.trim() === "") {
        throw new Error("path must be a non-empty string")
    }
    const trimmed = pathInput.trim()
    const resolved = isAbsolute(trimmed) ? resolve(trimmed) : resolve(getWorkspaceDir(), trimmed)
    return assertInsideWorkspace(resolved)
}

function normalizeLoadedRow(
    rawRow: Record<string, unknown>,
    table: TableRow,
    columns: ColumnSpec[],
    schema: JsonSchemaObject,
    rowIndex: number
): Record<string, unknown> {
    const known = new Set(columns.map((column) => column.name))
    const definition = parseTableDefinition(table)
    const primaryKeySlugSet = primaryKeyColumnSet(definition)
    for (const key of Object.keys(rawRow)) {
        if (!known.has(key) && !primaryKeySlugSet.has(key)) {
            throw new Error(`Row ${rowIndex}: unknown column "${key}" for table "${table.name}"`)
        }
    }
    const row: Record<string, unknown> = {}
    for (const column of columns) {
        if (!Object.hasOwn(rawRow, column.name)) {
            continue
        }
        try {
            row[column.name] = coerceCellValue(rawRow[column.name], column, schema)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new Error(`Row ${rowIndex}: ${message}`)
        }
    }
    return row
}

function parseCsv(text: string): Record<string, unknown>[] {
    const rows: string[][] = []
    let field = ""
    let row: string[] = []
    let inQuotes = false
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]!
        if (inQuotes) {
            if (char === '"') {
                if (text[index + 1] === '"') {
                    field += '"'
                    index += 1
                } else {
                    inQuotes = false
                }
            } else {
                field += char
            }
            continue
        }
        if (char === '"') {
            inQuotes = true
            continue
        }
        if (char === ",") {
            row.push(field)
            field = ""
            continue
        }
        if (char === "\n" || char === "\r") {
            if (char === "\r" && text[index + 1] === "\n") {
                index += 1
            }
            row.push(field)
            field = ""
            if (row.some((cell) => cell.length > 0) || row.length > 1) {
                rows.push(row)
            }
            row = []
            continue
        }
        field += char
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field)
        rows.push(row)
    }
    if (rows.length === 0) {
        return []
    }
    const headerRow = rows[0]
    if (!headerRow) {
        return []
    }
    const headers = headerRow.map((header) => header.trim())
    if (headers.some((header) => header === "")) {
        throw new Error("CSV header row contains an empty column name")
    }
    const result: Record<string, unknown>[] = []
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const cells = rows[rowIndex]!
        const object: Record<string, unknown> = {}
        for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
            object[headers[columnIndex]!] = cells[columnIndex] ?? ""
        }
        result.push(object)
    }
    return result
}

function escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) {
        return ""
    }
    const text = typeof value === "object" ? JSON.stringify(value) : String(value)
    if (/[",\n\r]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`
    }
    return text
}

function serializeCsv(rows: Record<string, unknown>[], headers: string[]): string {
    const lines = [headers.join(",")]
    for (const row of rows) {
        lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","))
    }
    return `${lines.join("\n")}\n`
}

function readRowsFromBuffer(data: Buffer | Uint8Array, mode: IoMode): Record<string, unknown>[] {
    if (mode === "json") {
        const parsed = JSON.parse(Buffer.from(data).toString("utf8")) as unknown
        if (!Array.isArray(parsed)) {
            throw new Error("JSON file must contain an array of row objects")
        }
        return parsed.map((item, index) => {
            if (item === null || typeof item !== "object" || Array.isArray(item)) {
                throw new Error(`JSON row ${index + 1} must be an object`)
            }
            return item as Record<string, unknown>
        })
    }
    if (mode === "jsonl") {
        const lines = Buffer.from(data).toString("utf8").split(/\r?\n/)
        const rows: Record<string, unknown>[] = []
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            const rawLine = lines[lineIndex]
            if (rawLine === undefined) {
                continue
            }
            const line = rawLine.trim()
            if (line === "") {
                continue
            }
            const parsed = JSON.parse(line) as unknown
            if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error(`JSONL line ${lineIndex + 1} must be an object`)
            }
            rows.push(parsed as Record<string, unknown>)
        }
        return rows
    }
    if (mode === "csv") {
        return parseCsv(Buffer.from(data).toString("utf8"))
    }
    const workbook = XLSX.read(Buffer.from(data), { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
        throw new Error("Excel workbook has no sheets")
    }
    const sheet = workbook.Sheets[sheetName]!
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false
    })
}

function readRowsFromFile(path: string, mode: IoMode): Record<string, unknown>[] {
    if (!existsSync(path)) {
        throw new Error(`File not found: ${path}`)
    }
    return readRowsFromBuffer(readFileSync(path), mode)
}

function serializeRowsToBuffer(
    mode: IoMode,
    rows: Record<string, unknown>[],
    headers: string[],
    sheetName: string
): Uint8Array {
    if (mode === "json") {
        return new TextEncoder().encode(`${JSON.stringify(rows, null, 2)}\n`)
    }
    if (mode === "jsonl") {
        const body = rows.map((row) => JSON.stringify(row)).join("\n")
        return new TextEncoder().encode(body === "" ? "" : `${body}\n`)
    }
    if (mode === "csv") {
        return new TextEncoder().encode(serializeCsv(rows, headers))
    }
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers })
    const workbook = XLSX.utils.book_new()
    const safeSheetName = sheetName.slice(0, 31) || "Sheet1"
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName)
    const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx"
    }) as Buffer
    return new Uint8Array(buffer)
}

function _writeRowsToFile(
    path: string,
    mode: IoMode,
    rows: Record<string, unknown>[],
    headers: string[],
    sheetName: string
): void {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, serializeRowsToBuffer(mode, rows, headers, sheetName))
}

function fetchAllDecodedRows(table: TableRow): Record<string, unknown>[] {
    const columns = getTableColumns(table)
    const rowSchema = JSON.parse(table.schema_json) as JsonSchemaObject
    const definition = parseTableDefinition(table)
    const primaryKeySlugsList = primaryKeySlugs(definition)
    const selectList = columns.map((column) => quoteIdentExport(column.name)).join(", ")
    const orderBy = primaryKeySlugsList.map((slug) => quoteIdentExport(slug)).join(", ")
    const rawRows = getDatabase()
        .query(`SELECT ${selectList} FROM ${quoteIdentExport(table.name)} ORDER BY ${orderBy}`)
        .all() as Record<string, unknown>[]
    return rawRows.map((row) => decodeRow(row, columns, rowSchema))
}

function insertRows(
    table: TableRow,
    rows: Record<string, unknown>[],
    onConflict: OnConflict
): { inserted: number; ignored: number; replaced: number } {
    const columns = getTableColumns(table)
    const schema = assertTableJsonSchema(JSON.parse(table.schema_json))
    const database = getDatabase()
    let inserted = 0
    let ignored = 0
    let replaced = 0
    database.run("BEGIN")
    try {
        for (let index = 0; index < rows.length; index += 1) {
            const normalized = normalizeLoadedRow(rows[index]!, table, columns, schema, index + 1)
            const result = insertTableRow(table, normalized, onConflict)
            if (result.outcome === "ignored") {
                ignored += 1
            } else if (result.outcome === "replaced") {
                replaced += 1
            } else {
                inserted += 1
            }
        }
        database.run("COMMIT")
    } catch (error) {
        database.run("ROLLBACK")
        throw error
    }
    const insertCount = inserted + replaced
    if (isUserTableName(table.name) && insertCount > 0) {
        recordStatsDelta({ inserts: insertCount })
    }
    return { inserted, ignored, replaced }
}

export function ioContentType(mode: IoMode): string {
    switch (mode) {
        case "csv":
            return "text/csv; charset=utf-8"
        case "json":
            return "application/json; charset=utf-8"
        case "jsonl":
            return "application/x-ndjson; charset=utf-8"
        case "xlsx":
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
}

export function ioFilename(tableName: string, mode: IoMode): string {
    return `${tableName}.${mode}`
}

export function dumpTableToBuffer(input: { table: string; mode: IoMode }): {
    table: string
    mode: IoMode
    count: number
    filename: string
    contentType: string
    body: Uint8Array
} {
    const table = requireTable(input.table)
    const rows = fetchAllDecodedRows(table)
    const columns = getTableColumns(table)
    const headers = columns.map((column) => column.name)
    const body = serializeRowsToBuffer(input.mode, rows, headers, table.name)
    return {
        table: table.name,
        mode: input.mode,
        count: rows.length,
        filename: ioFilename(table.name, input.mode),
        contentType: ioContentType(input.mode),
        body
    }
}

export function loadTableFromBuffer(input: {
    table: string
    mode: IoMode
    body: Uint8Array
    on_conflict?: OnConflict
}): {
    table: string
    mode: IoMode
    on_conflict: OnConflict
    inserted: number
    ignored: number
    replaced: number
} {
    const table = requireTable(input.table)
    const onConflict = parseOnConflict(input.on_conflict)
    const rows = readRowsFromBuffer(input.body, input.mode)
    const counts = insertRows(table, rows, onConflict)
    if (counts.inserted > 0 || counts.replaced > 0) {
        notifyInvalidation(invalidationTagsForRowMutation(table.name))
    }
    return {
        table: table.name,
        mode: input.mode,
        on_conflict: onConflict,
        inserted: counts.inserted,
        ignored: counts.ignored,
        replaced: counts.replaced
    }
}

export function loadTableFromFile(input: {
    table: string
    path: string
    mode: IoMode
    on_conflict?: OnConflict
}): {
    table: string
    path: string
    mode: IoMode
    on_conflict: OnConflict
    inserted: number
    ignored: number
    replaced: number
} {
    const table = requireTable(input.table)
    const path = resolveIoPath(input.path)
    const onConflict = parseOnConflict(input.on_conflict)
    const rows = readRowsFromFile(path, input.mode)
    const counts = insertRows(table, rows, onConflict)
    if (counts.inserted > 0 || counts.replaced > 0) {
        notifyInvalidation(invalidationTagsForRowMutation(table.name))
    }
    return {
        table: table.name,
        path,
        mode: input.mode,
        on_conflict: onConflict,
        inserted: counts.inserted,
        ignored: counts.ignored,
        replaced: counts.replaced
    }
}

export function dumpTableToFile(input: { table: string; path: string; mode: IoMode }): {
    table: string
    path: string
    mode: IoMode
    count: number
} {
    const table = requireTable(input.table)
    const path = resolveIoPath(input.path)
    const exported = dumpTableToBuffer({ table: input.table, mode: input.mode })
    writeFileSync(path, exported.body)
    return {
        table: table.name,
        path,
        mode: input.mode,
        count: exported.count
    }
}
