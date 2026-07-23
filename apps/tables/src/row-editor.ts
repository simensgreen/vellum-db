import type { ColumnData, ColumnDefinition } from "vellum-db/core/table/types"
import { primaryKeySlugs } from "vellum-db/core/table/types"
import type { TableSummary } from "./api.ts"

export type RowDraft = Record<string, string>

export type CellValidation = {
    valid: boolean
    error: string | null
    parsed: unknown
}

function customValidationError(data: ColumnData): string | undefined {
    if ("error" in data && typeof data.error === "string" && data.error.length > 0) {
        return data.error
    }
    return undefined
}

export function rowIdFromRecord(row: Record<string, unknown>, table: TableSummary): string {
    if (typeof row.id === "string" && row.id.length > 0) {
        return row.id
    }
    const primaryKeys = primaryKeySlugs(table.definition)
    if (primaryKeys.length === 1) {
        return String(row[primaryKeys[0]!] ?? "")
    }
    return primaryKeys.map((slug) => String(row[slug] ?? "")).join(":")
}

export function visibleColumns(table: TableSummary): ColumnDefinition[] {
    return table.definition.columns.filter((column) => column.uiMode !== "hidden")
}

export function editableColumns(table: TableSummary): ColumnDefinition[] {
    const primaryKeys = new Set(primaryKeySlugs(table.definition))
    return visibleColumns(table).filter((column) => !primaryKeys.has(column.slug))
}

export function primaryKeyColumnSlugs(table: TableSummary): Set<string> {
    return new Set(primaryKeySlugs(table.definition))
}

export function placeholderForColumn(column: ColumnDefinition): string {
    switch (column.data.type) {
        case "int":
            return column.data.min !== undefined ? String(column.data.min) : "0"
        case "float":
            return "0.0"
        case "bool":
            return "true / false"
        case "enum":
            return column.data.variants[0] ?? "Select…"
        case "json":
            return "{}"
        case "timestamp":
            if (column.data.default === "now") {
                return "Now (default)"
            }
            return "Date and time"
        case "nanoid":
            return "auto"
        case "ref":
            return `${column.data.table}.${column.data.column}`
        default:
            return column.name
    }
}

export function rowToDraft(row: Record<string, unknown>, columns: ColumnDefinition[]): RowDraft {
    const draft: RowDraft = {}
    for (const column of columns) {
        draft[column.slug] = formatDraftValue(row[column.slug], column)
    }
    return draft
}

export function formatDraftValue(value: unknown, column?: ColumnDefinition): string {
    if (value === null || value === undefined) {
        return ""
    }
    if (column?.data.type === "timestamp" && typeof value === "string") {
        return isoToDatetimeLocal(value)
    }
    if (typeof value === "object") {
        return JSON.stringify(value)
    }
    if (column?.data.type === "bool") {
        if (typeof value === "boolean") {
            return value ? "true" : "false"
        }
        if (typeof value === "number") {
            return value !== 0 ? "true" : "false"
        }
    }
    if (typeof value === "boolean") {
        return value ? "true" : "false"
    }
    return String(value)
}

export function formatCellValue(value: unknown, column?: ColumnDefinition): string {
    return formatDraftValue(value, column)
}

export function cellDisplayValue(
    column: ColumnDefinition,
    rowValue: unknown,
    draftValue: string,
    dirty: boolean
): string {
    if (dirty) {
        return draftValue
    }
    return formatDraftValue(rowValue, column)
}

export function usesSelectEditor(column: ColumnDefinition): boolean {
    return column.data.type === "enum"
}

export function isoToDatetimeLocal(iso: string): string {
    if (iso.trim() === "") {
        return ""
    }
    const parsed = new Date(iso)
    if (Number.isNaN(parsed.getTime())) {
        return iso.length >= 16 ? iso.slice(0, 16) : iso
    }
    const pad = (part: number) => String(part).padStart(2, "0")
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

export function datetimeLocalToIso(local: string): string {
    if (local.trim() === "") {
        return ""
    }
    const parsed = new Date(local)
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date and time")
    }
    return parsed.toISOString()
}

export function defaultInsertDraftValue(column: ColumnDefinition): string {
    const data = column.data
    switch (data.type) {
        case "int":
        case "float":
            return data.default !== undefined ? String(data.default) : ""
        case "bool":
            return data.default ? "true" : "false"
        case "str":
            return data.default ?? ""
        case "enum":
            return data.default !== undefined ? (data.variants[data.default] ?? "") : ""
        case "timestamp":
            if (data.default === "now") {
                return ""
            }
            if (data.default !== undefined) {
                return isoToDatetimeLocal(data.default.value)
            }
            return ""
        case "json":
            return data.default !== undefined ? JSON.stringify(data.default) : ""
        case "nanoid":
            return data.default !== "random" ? data.default.value : ""
        case "ref":
            return ""
    }
}

export function defaultInsertDraft(table: TableSummary): RowDraft {
    const draft: RowDraft = {}
    for (const column of editableColumns(table)) {
        draft[column.slug] = defaultInsertDraftValue(column)
    }
    return draft
}

export function draftDiffersFromDefault(draft: RowDraft, table: TableSummary): boolean {
    const template = defaultInsertDraft(table)
    for (const column of editableColumns(table)) {
        const draftValue = (draft[column.slug] ?? "").trim()
        const templateValue = (template[column.slug] ?? "").trim()
        if (draftValue !== templateValue) {
            return true
        }
    }
    return false
}

export function draftHasContent(draft: RowDraft): boolean {
    return Object.values(draft).some((value) => value.trim() !== "")
}

export function validateDraftCell(
    column: ColumnDefinition,
    raw: string,
    options: { required?: boolean } = {}
): CellValidation {
    const trimmed = raw.trim()
    const data = column.data

    if (trimmed === "") {
        if (options.required) {
            return {
                valid: false,
                error: customValidationError(data) ?? `${column.name} is required`,
                parsed: null
            }
        }
        return { valid: true, error: null, parsed: null }
    }

    try {
        const parsed = parseDraftValue(raw, column)
        const constraintError = constraintValidationError(column, parsed)
        if (constraintError) {
            return { valid: false, error: constraintError, parsed: undefined }
        }
        return { valid: true, error: null, parsed }
    } catch (error) {
        const fallback = error instanceof Error ? error.message : "Invalid value"
        return {
            valid: false,
            error: customValidationError(data) ?? fallback,
            parsed: undefined
        }
    }
}

function constraintValidationError(column: ColumnDefinition, parsed: unknown): string | null {
    const data = column.data
    switch (data.type) {
        case "int":
            if (typeof parsed !== "number" || !Number.isInteger(parsed)) {
                return customValidationError(data) ?? `${column.name} must be an integer`
            }
            if (data.min !== undefined && parsed < data.min) {
                return customValidationError(data) ?? `Number must be at least ${data.min}`
            }
            if (data.max !== undefined && parsed > data.max) {
                return customValidationError(data) ?? `Number must be at most ${data.max}`
            }
            return null
        case "float":
            if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
                return customValidationError(data) ?? `${column.name} must be a number`
            }
            if (data.min !== undefined && parsed < data.min) {
                return customValidationError(data) ?? `Number must be at least ${data.min}`
            }
            if (data.max !== undefined && parsed > data.max) {
                return customValidationError(data) ?? `Number must be at most ${data.max}`
            }
            return null
        case "str":
            if (typeof parsed !== "string") {
                return customValidationError(data) ?? `${column.name} must be text`
            }
            if (data.minLen !== undefined && parsed.length < data.minLen) {
                return (
                    customValidationError(data) ?? `Text must be at least ${data.minLen} characters`
                )
            }
            if (data.maxLen !== undefined && parsed.length > data.maxLen) {
                return (
                    customValidationError(data) ?? `Text must be at most ${data.maxLen} characters`
                )
            }
            if (data.regex?.regex) {
                const pattern = new RegExp(data.regex.regex)
                if (!pattern.test(parsed)) {
                    return (
                        data.regex.error ??
                        customValidationError(data) ??
                        `${column.name} has an invalid format`
                    )
                }
            }
            return null
        case "enum":
            if (typeof parsed !== "string" || !data.variants.includes(parsed)) {
                return customValidationError(data) ?? `Select one of: ${data.variants.join(", ")}`
            }
            return null
        case "timestamp":
            if (typeof parsed !== "string" || Number.isNaN(new Date(parsed).getTime())) {
                return customValidationError(data) ?? "Enter a valid date and time"
            }
            return null
        case "bool":
            if (typeof parsed !== "boolean") {
                return customValidationError(data) ?? "Select true or false"
            }
            return null
        case "json":
            return null
        case "nanoid":
            if (typeof parsed !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(parsed)) {
                return customValidationError(data) ?? "Invalid ID format"
            }
            return null
        case "ref":
            if (typeof parsed !== "string" || parsed.length === 0) {
                return customValidationError(data) ?? `${column.name} is required`
            }
            return null
    }
}

export function parseDraftValue(raw: string, column: ColumnDefinition): unknown {
    const trimmed = raw.trim()
    if (trimmed === "") {
        return null
    }
    switch (column.data.type) {
        case "int": {
            const parsed = Number.parseInt(trimmed, 10)
            if (!Number.isFinite(parsed)) {
                throw new Error(`${column.name} must be an integer`)
            }
            return parsed
        }
        case "float": {
            const parsed = Number.parseFloat(trimmed)
            if (!Number.isFinite(parsed)) {
                throw new Error(`${column.name} must be a number`)
            }
            return parsed
        }
        case "bool":
            if (trimmed === "true" || trimmed === "1") {
                return true
            }
            if (trimmed === "false" || trimmed === "0") {
                return false
            }
            throw new Error("Select true or false")
        case "timestamp":
            return datetimeLocalToIso(trimmed)
        case "json":
            return JSON.parse(trimmed) as unknown
        default:
            return trimmed
    }
}

export function columnRequiredForInsert(column: ColumnDefinition): boolean {
    if (column.nullable === true) {
        return false
    }
    const data = column.data
    switch (data.type) {
        case "int":
        case "float":
        case "str":
            return data.default === undefined
        case "bool":
            return false
        case "enum":
            return data.default === undefined
        case "nanoid":
            return data.default !== "random"
        case "timestamp":
            return data.default === undefined
        case "json":
        case "ref":
            return true
    }
}

export function fieldErrorsForDraft(
    draft: RowDraft,
    columns: ColumnDefinition[],
    options: {
        forInsert?: boolean
        showAllRequired?: boolean
    } = {}
): Map<string, string> {
    const errors = new Map<string, string>()

    for (const column of columns) {
        const raw = draft[column.slug] ?? ""
        const required =
            options.forInsert === true &&
            columnRequiredForInsert(column) &&
            options.showAllRequired === true
        const validation = validateDraftCell(column, raw, { required })
        if (!validation.valid && validation.error) {
            if (raw.trim() !== "" || required) {
                errors.set(column.slug, validation.error)
            }
        }
    }

    return errors
}

export function insertDraftCommitErrors(
    draft: RowDraft,
    columns: ColumnDefinition[]
): Map<string, string> {
    return fieldErrorsForDraft(draft, columns, {
        forInsert: true,
        showAllRequired: true
    })
}

export function parseDraftRow(draft: RowDraft, table: TableSummary): Record<string, unknown> {
    const row: Record<string, unknown> = {}
    for (const column of editableColumns(table)) {
        const raw = draft[column.slug]
        if (raw === undefined || raw.trim() === "") {
            continue
        }
        const validation = validateDraftCell(column, raw, {
            required: column.nullable !== true
        })
        if (!validation.valid) {
            throw new Error(validation.error ?? `Invalid ${column.slug}`)
        }
        row[column.slug] = validation.parsed
    }
    return row
}

export function emptyInsertDraft(table: TableSummary): RowDraft {
    return defaultInsertDraft(table)
}
