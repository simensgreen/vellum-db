import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks"
import type { RowsResponse, TableSummary } from "../api.ts"
import { commitRows, exportTableFile, importTableFile } from "../api.ts"
import { rowIdFromRecord, visibleColumns } from "../row-editor.ts"
import { showToastError, showValidationToast } from "../toast.ts"
import { useTableStaging } from "../useTableStaging.ts"
import { ChevronLeftIcon, ChevronRightIcon } from "./ChevronIcons.tsx"
import { FormatMenu, type IoFormat } from "./FormatMenu.tsx"
import { ExportIcon, ImportIcon } from "./IoIcons.tsx"
import { RowActionCell } from "./RowActionCell.tsx"
import { DraftInsertRowCells, RowCells } from "./RowCells.tsx"
import { RowsGridSkeleton } from "./RowsGridSkeleton.tsx"

const DEFAULT_ROW_LIMIT = 50

function formatCount(value: number): string {
    return new Intl.NumberFormat().format(value)
}

function formatRowRange(offset: number, limit: number, count: number): string {
    if (count === 0) {
        return "0 rows"
    }
    const rangeEnd = Math.min(offset + limit, count)
    return `${formatCount(offset)}–${formatCount(rangeEnd)} of ${formatCount(count)}`
}

function RowsPager({
    offset,
    limit,
    count,
    hasMore,
    onOffsetChange,
    onLimitChange
}: {
    offset: number
    limit: number
    count: number
    hasMore: boolean
    onOffsetChange: (offset: number) => void
    onLimitChange: (limit: number) => void
}) {
    const [limitDraft, setLimitDraft] = useState(String(limit))

    useEffect(() => {
        setLimitDraft(String(limit))
    }, [limit])

    function commitLimitDraft(): void {
        const parsed = Number.parseInt(limitDraft, 10)
        if (!Number.isFinite(parsed) || parsed < 1) {
            setLimitDraft(String(limit))
            return
        }
        if (parsed !== limit) {
            onLimitChange(parsed)
        }
    }

    return (
        <div class="rows-grid__pager">
            <button
                type="button"
                class="v-button secondary rows-grid__pager-btn"
                disabled={offset <= 0}
                aria-label="Previous rows"
                onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            >
                <ChevronLeftIcon />
            </button>
            <span class="rows-grid__range">{formatRowRange(offset, limit, count)}</span>
            <label class="rows-grid__limit">
                <span class="rows-grid__limit-label">Limit</span>
                <input
                    type="number"
                    min={1}
                    step={1}
                    class="rows-grid__limit-input"
                    value={limitDraft}
                    onInput={(event) => setLimitDraft((event.target as HTMLInputElement).value)}
                    onBlur={commitLimitDraft}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            commitLimitDraft()
                            ;(event.target as HTMLInputElement).blur()
                        }
                    }}
                />
            </label>
            <button
                type="button"
                class="v-button secondary rows-grid__pager-btn"
                disabled={!hasMore}
                aria-label="Next rows"
                onClick={() => onOffsetChange(offset + limit)}
            >
                <ChevronRightIcon />
            </button>
        </div>
    )
}

export function RowsGrid({
    table,
    rowsState,
    limit,
    onOffsetChange,
    onLimitChange,
    onApplySuccess
}: {
    table: TableSummary
    rowsState: RowsResponse | null
    limit: number
    onOffsetChange: (offset: number) => void
    onLimitChange: (limit: number) => void
    onApplySuccess?: () => void
}) {
    const staging = useTableStaging(rowsState, table)

    const scrollRef = useRef<HTMLDivElement>(null)
    const theadRef = useRef<HTMLTableSectionElement>(null)
    const importInputRef = useRef<HTMLInputElement>(null)
    const [ioBusy, setIoBusy] = useState(false)

    const displayColumns = useMemo(() => visibleColumns(table), [table])
    const tableName = table.name
    const tableTitle = table.definition.name

    useLayoutEffect(() => {
        const scrollElement = scrollRef.current
        const theadElement = theadRef.current
        if (!scrollElement || !theadElement) {
            return
        }

        const headerRowElement = theadElement.querySelector(".rows-grid__header-row")
        if (!headerRowElement) {
            return
        }

        function syncTheadHeight(): void {
            const theadHeight = headerRowElement?.getBoundingClientRect().height
            scrollElement?.style.setProperty("--rows-grid-thead-height", `${theadHeight}px`)
        }

        syncTheadHeight()
        const observer = new ResizeObserver(syncTheadHeight)
        observer.observe(headerRowElement)
        return () => observer.disconnect()
    }, [rowsState, table, displayColumns.length, staging.patch.insert.length])

    if (!rowsState) {
        return <RowsGridSkeleton table={table} />
    }

    const visibleRowIds = rowsState.rows.map((row) => rowIdFromRecord(row, table))
    const allVisibleSelected =
        visibleRowIds.length > 0 && visibleRowIds.every((rowId) => staging.isMarkedDelete(rowId))
    const someVisibleSelected = visibleRowIds.some((rowId) => staging.isMarkedDelete(rowId))

    const totalCount = rowsState.total_count

    async function handleExport(format: IoFormat): Promise<void> {
        setIoBusy(true)
        try {
            const exported = await exportTableFile(tableName, format)
            const url = URL.createObjectURL(exported.blob)
            const anchor = document.createElement("a")
            anchor.href = url
            anchor.download = exported.filename
            anchor.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            showToastError(error instanceof Error ? error.message : "Failed to export table")
        } finally {
            setIoBusy(false)
        }
    }

    function startImport(): void {
        importInputRef.current?.click()
    }

    async function handleImportFile(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ""
        if (!file) {
            return
        }
        setIoBusy(true)
        try {
            await importTableFile(tableName, file)
            onApplySuccess?.()
        } catch (error) {
            showToastError(error instanceof Error ? error.message : "Failed to import table")
        } finally {
            setIoBusy(false)
        }
    }

    async function handleApply(): Promise<void> {
        if (!staging.validateForCommit()) {
            showValidationToast(staging.validationErrorMessages)
            return
        }

        const body = staging.toCommitBody()

        staging.beginApply()
        try {
            await commitRows(tableName, body)
            staging.succeedApply()
            onApplySuccess?.()
        } catch (error) {
            showToastError(error instanceof Error ? error.message : "Failed to apply changes")
            staging.failApply()
        }
    }

    return (
        <div class="rows-grid">
            <div class="rows-grid__sticky-bar">
                <div class="rows-grid__header">
                    <div class="rows-grid__header-main">
                        <h2 class="rows-grid__title">{tableTitle}</h2>
                        <span class="v-badge">
                            {formatCount(totalCount)} row{totalCount === 1 ? "" : "s"}
                        </span>
                    </div>
                    <div class="rows-grid__header-actions">
                        <FormatMenu
                            icon={<ExportIcon />}
                            ariaLabel="Export table"
                            disabled={ioBusy || staging.applying}
                            onSelect={(format) => void handleExport(format)}
                        />
                        <button
                            type="button"
                            class="v-button secondary rows-grid__io-btn"
                            aria-label="Import table"
                            title="Import table"
                            disabled={ioBusy || staging.applying}
                            onClick={startImport}
                        >
                            <ImportIcon />
                        </button>
                        <input
                            ref={importInputRef}
                            type="file"
                            class="rows-grid__import-input"
                            accept=".csv,.json,.jsonl,.xlsx,application/json,text/csv"
                            onChange={(event) => void handleImportFile(event)}
                        />
                    </div>
                </div>

                <div class="rows-grid__toolbar-row">
                    <RowsPager
                        offset={rowsState.offset}
                        limit={limit}
                        count={totalCount}
                        hasMore={rowsState.has_more}
                        onOffsetChange={onOffsetChange}
                        onLimitChange={onLimitChange}
                    />

                    {staging.hasPending || staging.applying ? (
                        <div class="rows-grid__commit-actions">
                            <span class="rows-grid__change-count">
                                {staging.applying
                                    ? "Applying…"
                                    : `${staging.pendingCount} change${staging.pendingCount === 1 ? "" : "s"}`}
                            </span>
                            <button
                                type="button"
                                class="v-button secondary"
                                disabled={staging.applying}
                                onClick={() => staging.cancelAll()}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="v-button primary"
                                disabled={staging.applying}
                                onClick={() => void handleApply()}
                            >
                                Apply
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <div class="rows-grid__scroll" ref={scrollRef}>
                <table class="v-data-table rows-grid__table">
                    <thead ref={theadRef}>
                        <tr class="rows-grid__header-row">
                            <th class="rows-grid__select-col">
                                {visibleRowIds.length > 0 ? (
                                    <RowActionCell
                                        variant="header"
                                        allVisibleSelected={allVisibleSelected}
                                        someVisibleSelected={someVisibleSelected}
                                        onMarkAllVisible={() =>
                                            staging.toggleSelectAllVisible(visibleRowIds, true)
                                        }
                                        onUnmarkAllVisible={() =>
                                            staging.toggleSelectAllVisible(visibleRowIds, false)
                                        }
                                    />
                                ) : null}
                            </th>
                            {displayColumns.map((column) => (
                                <th key={column.slug}>{column.name}</th>
                            ))}
                        </tr>
                        <tr class="rows-grid__row rows-grid__row--draft">
                            <td class="rows-grid__select-col">
                                <RowActionCell
                                    variant="draft"
                                    draftDiffersFromDefault={staging.phantomDirty}
                                    onClearDraft={() => staging.clearPhantom()}
                                />
                            </td>
                            <DraftInsertRowCells
                                table={table}
                                draft={staging.phantom}
                                showValidationErrors={staging.validationAttempted}
                                fieldErrors={staging.fieldErrorsForRow("phantom", "phantom")}
                                onChange={(slug, value, cursor) =>
                                    staging.setPhantomCell(slug, value, cursor)
                                }
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {staging.patch.insert.map((insertEntry) => (
                            <tr
                                key={insertEntry.localId}
                                class="rows-grid__row rows-grid__row--added"
                            >
                                <td class="rows-grid__select-col">
                                    <RowActionCell
                                        variant="insert"
                                        onRemoveInsert={() =>
                                            staging.removeInsert(insertEntry.localId)
                                        }
                                    />
                                </td>
                                <RowCells
                                    table={table}
                                    row={{}}
                                    rowKey={insertEntry.localId}
                                    draft={insertEntry.cells}
                                    alwaysEditing
                                    showValidationErrors={staging.validationAttempted}
                                    insertFocusTarget={staging.insertFocusTarget}
                                    onInsertFocused={staging.clearInsertFocusTarget}
                                    fieldErrors={staging.fieldErrorsForRow(
                                        "insert",
                                        insertEntry.localId
                                    )}
                                    onChange={(slug, value) =>
                                        staging.updateInsert(insertEntry.localId, slug, value)
                                    }
                                />
                            </tr>
                        ))}

                        {rowsState.rows.map((row) => {
                            const rowId = rowIdFromRecord(row, table)
                            const markedDelete = staging.isMarkedDelete(rowId)
                            const editingSlug =
                                staging.editingCell?.rowId === rowId
                                    ? staging.editingCell.slug
                                    : null
                            const draft = staging.displayRow(row, rowId)
                            const dirtySlugs = staging.dirtySlugs(row, rowId)
                            const rowClass = markedDelete
                                ? "rows-grid__row rows-grid__row--deleted"
                                : "rows-grid__row"

                            return (
                                <tr key={rowId} class={rowClass}>
                                    <td class="rows-grid__select-col">
                                        <RowActionCell
                                            variant="existing"
                                            markedForDelete={markedDelete}
                                            onMarkForDelete={() =>
                                                staging.toggleDelete(rowId, true)
                                            }
                                            onUnmarkDelete={() =>
                                                staging.toggleDelete(rowId, false)
                                            }
                                        />
                                    </td>
                                    <RowCells
                                        table={table}
                                        row={row}
                                        draft={draft}
                                        editingSlug={editingSlug}
                                        dirtySlugs={dirtySlugs}
                                        showValidationErrors={staging.validationAttempted}
                                        fieldErrors={staging.fieldErrorsForRow("row", rowId)}
                                        onStartEditing={(slug) =>
                                            staging.startEditingCell(rowId, slug)
                                        }
                                        onStopEditing={staging.stopEditingCell}
                                        onChange={(slug, value) =>
                                            staging.setCell(rowId, slug, value, row)
                                        }
                                    />
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export { DEFAULT_ROW_LIMIT }
