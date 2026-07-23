import { requireTable, type TableRow } from "./catalog.ts"
import { type InsertOutcome, insertTableRow, type OnConflict, parseOnConflict } from "./insert.ts"
import { isUserTableName, recordStatsDelta } from "./stats-store.ts"
import { notifyInvalidation } from "./sync.ts"
import { invalidationTagsForRowMutation } from "./sync-tags.ts"

export type { InsertOutcome, OnConflict }

export function insertRow(input: {
    table: string
    row: Record<string, unknown>
    on_conflict?: OnConflict
    sideEffects?: boolean
}) {
    const sideEffects = input.sideEffects ?? true
    const table = requireTable(input.table)
    const onConflict = parseOnConflict(input.on_conflict)
    const result = insertTableRow(table, input.row, onConflict)
    if (sideEffects && result.outcome !== "ignored") {
        notifyInvalidation(invalidationTagsForRowMutation(table.name))
        if (isUserTableName(table.name)) {
            recordStatsDelta({ inserts: 1 })
        }
    }
    return {
        table: table.name,
        id: result.id,
        changes: result.changes,
        outcome: result.outcome,
        on_conflict: onConflict
    }
}

export { insertTableRow, parseOnConflict, requireTable, type TableRow }
