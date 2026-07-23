import { useMemo, useState } from "preact/hooks"
import { alterTable, type TableSummary } from "../api.ts"
import {
    emptyVisualColumn,
    syncVisualColumnSlug,
    type VisualColumn
} from "../table-definition-editor/index.ts"
import { Toggle } from "./Toggle.tsx"

function existingColumnSlugs(table: TableSummary): Set<string> {
    return new Set(table.definition.columns.map((column) => column.slug))
}

function primaryKeySlugs(table: TableSummary): Set<string> {
    return new Set(
        table.definition.columns.filter((column) => column.primaryKey).map((column) => column.slug)
    )
}

export function EditTableForm({
    table,
    onCancel,
    onSaved
}: {
    table: TableSummary
    onCancel: () => void
    onSaved: () => void
}) {
    const existingSlugs = useMemo(() => existingColumnSlugs(table), [table])
    const pkSlugs = useMemo(() => primaryKeySlugs(table), [table])
    const [newColumns, setNewColumns] = useState<VisualColumn[]>([emptyVisualColumn()])
    const [dropColumns, setDropColumns] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    function updateNewColumn(index: number, patch: Partial<VisualColumn>): void {
        setNewColumns((current) =>
            current.map((column, columnIndex) => {
                if (columnIndex !== index) {
                    return column
                }
                const merged = { ...column, ...patch }
                if (patch.name !== undefined && patch.slugDirty !== true) {
                    return syncVisualColumnSlug(merged)
                }
                return merged
            })
        )
    }

    function removeNewColumn(index: number): void {
        setNewColumns((current) =>
            current.length <= 1
                ? current
                : current.filter((_, columnIndex) => columnIndex !== index)
        )
    }

    function toggleDrop(columnSlug: string, drop: boolean): void {
        setDropColumns((current) => {
            const next = new Set(current)
            if (drop) {
                next.add(columnSlug)
            } else {
                next.delete(columnSlug)
            }
            return next
        })
    }

    async function handleSubmit(event: Event): Promise<void> {
        event.preventDefault()
        setError(null)

        let add:
            | Array<{
                  name: string
                  slug: string
                  column: TableSummary["definition"]["columns"][number]
              }>
            | undefined
        let drop: string[] | undefined

        const additions = newColumns
            .map((column) => syncVisualColumnSlug({ ...column }))
            .filter((column) => column.slug.trim())
        for (const column of additions) {
            const slug = column.slug.trim()
            if (existingSlugs.has(slug)) {
                setError(`Column "${slug}" already exists`)
                return
            }
        }
        if (additions.length > 0) {
            add = additions.map((column) => ({
                name: column.name.trim() || column.slug.trim(),
                slug: column.slug.trim(),
                column: {
                    name: column.name.trim() || column.slug.trim(),
                    slug: column.slug.trim(),
                    ...(column.nullable ? { nullable: true } : {}),
                    ...(column.unique ? { unique: true } : {}),
                    ...(column.primaryKey ? { primaryKey: true } : {}),
                    data: column.data
                }
            }))
        }
        if (dropColumns.size > 0) {
            drop = [...dropColumns]
        }

        if ((!add || add.length === 0) && (!drop || drop.length === 0)) {
            setError("Add or drop at least one column")
            return
        }

        if (drop?.some((slug) => pkSlugs.has(slug))) {
            setError("Cannot drop primary key columns")
            return
        }

        setSubmitting(true)
        try {
            await alterTable({
                table: table.slug,
                add,
                drop
            })
            onSaved()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Failed to alter table")
        } finally {
            setSubmitting(false)
        }
    }

    const droppableColumns = table.definition.columns.filter((column) => !pkSlugs.has(column.slug))

    return (
        <div class="form-panel v-card">
            <div class="form-panel__header">
                <h2>Edit schema: {table.definition.name}</h2>
                <button type="button" class="v-button secondary" onClick={onCancel}>
                    Cancel
                </button>
            </div>

            <form class="form-panel__body" onSubmit={(event) => void handleSubmit(event)}>
                <section class="column-editor-section">
                    <h3>Existing columns</h3>
                    {droppableColumns.length === 0 ? (
                        <div class="v-empty-state">No droppable columns.</div>
                    ) : (
                        <ul class="existing-columns">
                            {droppableColumns.map((column) => (
                                <li key={column.slug}>
                                    <span>
                                        {column.slug}{" "}
                                        <span class="v-badge">{column.data.type}</span>
                                    </span>
                                    <div class="column-card__switch">
                                        <span>Drop</span>
                                        <Toggle
                                            checked={dropColumns.has(column.slug)}
                                            ariaLabel={`Drop column ${column.slug}`}
                                            onCheckedChange={(pressed) =>
                                                toggleDrop(column.slug, pressed)
                                            }
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section class="column-editor-section">
                    <h3>Add columns</h3>
                    <div class="column-editor">
                        {newColumns.map((column, index) => (
                            <div class="column-editor__row" key={column.key}>
                                <input
                                    type="text"
                                    value={column.name}
                                    placeholder="Column name"
                                    onInput={(event) =>
                                        updateNewColumn(index, {
                                            name: (event.target as HTMLInputElement).value
                                        })
                                    }
                                />
                                <input
                                    type="text"
                                    value={column.slug}
                                    placeholder="column_slug"
                                    onInput={(event) =>
                                        updateNewColumn(index, {
                                            slug: (event.target as HTMLInputElement).value,
                                            slugDirty: true
                                        })
                                    }
                                />
                                <button
                                    type="button"
                                    class="v-button secondary"
                                    disabled={newColumns.length <= 1}
                                    onClick={() => removeNewColumn(index)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            class="v-button secondary"
                            onClick={() =>
                                setNewColumns((current) => [...current, emptyVisualColumn()])
                            }
                        >
                            Add column
                        </button>
                    </div>
                </section>

                {error ? <div class="app-message app-message--error">{error}</div> : null}

                <div class="form-panel__actions">
                    <button type="submit" class="v-button" disabled={submitting}>
                        {submitting ? "Saving…" : "Save changes"}
                    </button>
                </div>
            </form>
        </div>
    )
}
