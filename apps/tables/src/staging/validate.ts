import type { ColumnDefinition } from "vellum-db/core/table/types"
import type { RowsResponse, TableSummary } from "../api.ts"
import {
    draftDiffersFromDefault,
    insertDraftCommitErrors,
    type RowDraft,
    rowIdFromRecord,
    validateDraftCell
} from "../row-editor.ts"
import type { StagingPatch } from "./types.ts"

export type FieldErrorsByRow = Map<string, Map<string, string>>

function rowErrorKey(prefix: string, rowKey: string): string {
    return `${prefix}:${rowKey}`
}

export function buildStagingValidationErrors(input: {
    rowsState: RowsResponse | null
    table: TableSummary
    patch: StagingPatch
    phantom: RowDraft
    columns: ColumnDefinition[]
}): FieldErrorsByRow {
    const errors: FieldErrorsByRow = new Map()

    for (const insertEntry of input.patch.insert) {
        const rowErrors = insertDraftCommitErrors(insertEntry.cells, input.columns)
        if (rowErrors.size > 0) {
            errors.set(rowErrorKey("insert", insertEntry.localId), rowErrors)
        }
    }

    if (draftDiffersFromDefault(input.phantom, input.table)) {
        const rowErrors = insertDraftCommitErrors(input.phantom, input.columns)
        if (rowErrors.size > 0) {
            errors.set(rowErrorKey("phantom", "phantom"), rowErrors)
        }
    }

    if (input.rowsState) {
        for (const row of input.rowsState.rows) {
            const pk = rowIdFromRecord(row, input.table)
            const rowPatch = input.patch.update[pk]
            if (!rowPatch) {
                continue
            }
            const rowErrors = new Map<string, string>()
            for (const column of input.columns) {
                const raw = rowPatch[column.slug]
                if (raw === undefined) {
                    continue
                }
                const validation = validateDraftCell(column, raw, { required: false })
                if (!validation.valid && validation.error) {
                    rowErrors.set(column.slug, validation.error)
                }
            }
            if (rowErrors.size > 0) {
                errors.set(rowErrorKey("row", pk), rowErrors)
            }
        }
    }

    return errors
}

export function countValidationErrors(errors: FieldErrorsByRow): number {
    let count = 0
    for (const rowErrors of errors.values()) {
        count += rowErrors.size
    }
    return count
}

export function validationMessages(table: TableSummary, errors: FieldErrorsByRow): string[] {
    const messages: string[] = []
    for (const rowErrors of errors.values()) {
        for (const [slug, message] of rowErrors) {
            const column = table.definition.columns.find((entry) => entry.slug === slug)
            messages.push(`${column?.name}: ${message}`)
        }
    }
    return messages
}

export function fieldErrorsForRow(
    errors: FieldErrorsByRow,
    prefix: "row" | "insert" | "phantom",
    rowKey: string
): Map<string, string> {
    return errors.get(rowErrorKey(prefix, rowKey)) ?? new Map()
}
