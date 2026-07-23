import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import type { RowCommitBody, RowsResponse, TableSummary } from "./api.ts"
import {
    draftDiffersFromDefault,
    editableColumns,
    type RowDraft,
    rowIdFromRecord
} from "./row-editor.ts"
import {
    countChanges,
    dirtySlugsForRow,
    emptyPhantom,
    isMarkedDelete,
    mergeRowForDisplay,
    promotePhantomToInsert,
    removeInsert,
    setCellUpdate,
    toggleDelete,
    toggleSelectAllDeletes,
    updateInsertCell
} from "./staging/patch-ops.ts"
import { patchToCommitBody } from "./staging/to-commit.ts"
import { emptyPatch, type StagingPatch } from "./staging/types.ts"
import {
    buildStagingValidationErrors,
    countValidationErrors,
    type FieldErrorsByRow,
    fieldErrorsForRow,
    validationMessages
} from "./staging/validate.ts"

export type { FieldErrorsByRow }

export type InsertFocusTarget = {
    localId: string
    slug: string
    cursor: number
}

export function useTableStaging(rowsState: RowsResponse | null, table: TableSummary) {
    const [patch, setPatch] = useState<StagingPatch>(() => emptyPatch())
    const [phantom, setPhantom] = useState<RowDraft>(() => emptyPhantom(table))
    const [editingCell, setEditingCell] = useState<{
        rowId: string
        slug: string
    } | null>(null)
    const [applying, setApplying] = useState(false)
    const [validationAttempted, setValidationAttempted] = useState(false)
    const [insertFocusTarget, setInsertFocusTarget] = useState<InsertFocusTarget | null>(null)

    const columns = useMemo(() => editableColumns(table), [table])

    useEffect(() => {
        setPatch(emptyPatch())
        setPhantom(emptyPhantom(table))
        setEditingCell(null)
        setApplying(false)
        setValidationAttempted(false)
        setInsertFocusTarget(null)
    }, [rowsState, table])

    const originalsByPk = useMemo(() => {
        const map = new Map<string, Record<string, unknown>>()
        if (!rowsState) {
            return map
        }
        for (const row of rowsState.rows) {
            map.set(rowIdFromRecord(row, table), row)
        }
        return map
    }, [rowsState, table])

    const phantomDirty = useMemo(() => draftDiffersFromDefault(phantom, table), [phantom, table])

    const validationErrors = useMemo(
        (): FieldErrorsByRow =>
            buildStagingValidationErrors({
                rowsState,
                table,
                patch,
                phantom,
                columns
            }),
        [columns, patch, phantom, rowsState, table]
    )

    const validationErrorCount = useMemo(
        () => countValidationErrors(validationErrors),
        [validationErrors]
    )

    const validationErrorMessages = useMemo(
        () => validationMessages(table, validationErrors),
        [table, validationErrors]
    )

    const pendingCount = useMemo(() => countChanges(patch, phantomDirty), [patch, phantomDirty])

    const hasPending = pendingCount > 0

    const cancelAll = useCallback(() => {
        setPatch(emptyPatch())
        setPhantom(emptyPhantom(table))
        setEditingCell(null)
        setValidationAttempted(false)
    }, [table])

    const startEditingCell = useCallback((rowId: string, slug: string) => {
        setEditingCell({ rowId, slug })
    }, [])

    const stopEditingCell = useCallback(() => {
        setEditingCell(null)
    }, [])

    const setCell = useCallback(
        (pk: string, slug: string, raw: string, original: Record<string, unknown>) => {
            setPatch((current) => setCellUpdate(current, pk, slug, raw, original, columns))
        },
        [columns]
    )

    const setPhantomCell = useCallback(
        (slug: string, raw: string, cursor = raw.length) => {
            setPhantom((current) => {
                const next = { ...current, [slug]: raw }
                if (draftDiffersFromDefault(next, table)) {
                    setPatch((patchCurrent) => {
                        const { patch: promotedPatch, insert } = promotePhantomToInsert(
                            patchCurrent,
                            next
                        )
                        setInsertFocusTarget({ localId: insert.localId, slug, cursor })
                        return promotedPatch
                    })
                    return emptyPhantom(table)
                }
                return next
            })
        },
        [table]
    )

    const updateInsert = useCallback((localId: string, slug: string, raw: string) => {
        setPatch((current) => updateInsertCell(current, localId, slug, raw))
    }, [])

    const removeInsertRow = useCallback((localId: string) => {
        setPatch((current) => removeInsert(current, localId))
        setInsertFocusTarget((current) => (current?.localId === localId ? null : current))
    }, [])

    const clearPhantom = useCallback(() => {
        setPhantom(emptyPhantom(table))
    }, [table])

    const clearInsertFocusTarget = useCallback(() => {
        setInsertFocusTarget(null)
    }, [])

    const validateForCommit = useCallback((): boolean => {
        setValidationAttempted(true)
        return countValidationErrors(validationErrors) === 0
    }, [validationErrors])

    const toCommitBody = useCallback((): RowCommitBody => {
        const body = patchToCommitBody(patch, table, originalsByPk, columns)
        if (phantomDirty) {
            const phantomBody = patchToCommitBody(
                {
                    insert: [{ localId: "phantom", cells: phantom }],
                    update: {},
                    delete: []
                },
                table,
                originalsByPk,
                columns
            )
            body.insert = [...phantomBody.insert, ...body.insert]
        }
        return {
            ...(body.insert.length > 0 ? { insert: body.insert } : {}),
            ...(Object.keys(body.update).length > 0 ? { update: body.update } : {}),
            ...(body.delete.length > 0 ? { delete: body.delete } : {})
        }
    }, [columns, originalsByPk, patch, phantom, phantomDirty, table])

    const beginApply = useCallback(() => {
        setApplying(true)
    }, [])

    const failApply = useCallback(() => {
        setApplying(false)
    }, [])

    const succeedApply = useCallback(() => {
        setPatch(emptyPatch())
        setPhantom(emptyPhantom(table))
        setEditingCell(null)
        setApplying(false)
        setValidationAttempted(false)
        setInsertFocusTarget(null)
    }, [table])

    const displayRow = useCallback(
        (original: Record<string, unknown>, pk: string): RowDraft =>
            mergeRowForDisplay(original, patch.update[pk], columns),
        [columns, patch.update]
    )

    const dirtySlugs = useCallback(
        (original: Record<string, unknown>, pk: string): Set<string> =>
            dirtySlugsForRow(original, patch.update[pk], columns),
        [columns, patch.update]
    )

    const fieldErrorsForStagingRow = useCallback(
        (prefix: "row" | "insert" | "phantom", rowKey: string): Map<string, string> => {
            if (!validationAttempted) {
                return new Map()
            }
            return fieldErrorsForRow(validationErrors, prefix, rowKey)
        },
        [validationAttempted, validationErrors]
    )

    return {
        patch,
        phantom,
        columns,
        editingCell,
        hasPending,
        pendingCount,
        phantomDirty,
        validationAttempted,
        validationErrorCount,
        validationErrorMessages,
        applying,
        insertFocusTarget,
        cancelAll,
        isMarkedDelete: (pk: string) => isMarkedDelete(patch, pk),
        toggleDelete: (pk: string, marked: boolean) =>
            setPatch((current) => toggleDelete(current, pk, marked)),
        toggleSelectAllVisible: (pks: string[], marked: boolean) =>
            setPatch((current) => toggleSelectAllDeletes(current, pks, marked)),
        startEditingCell,
        stopEditingCell,
        setCell,
        setPhantomCell,
        updateInsert,
        removeInsert: removeInsertRow,
        clearPhantom,
        clearInsertFocusTarget,
        displayRow,
        dirtySlugs,
        fieldErrorsForRow: fieldErrorsForStagingRow,
        validateForCommit,
        toCommitBody,
        beginApply,
        failApply,
        succeedApply
    }
}
