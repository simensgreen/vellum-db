import type { ComponentChildren } from "preact"
import { TrashIcon } from "./TrashIcon.tsx"

function preventFocusSteal(event: Event): void {
    event.preventDefault()
}

function ActionColFrame({ children }: { children?: ComponentChildren }) {
    return <div class="rows-grid__select-col-inner">{children}</div>
}

export function RowActionCell({
    variant,
    markedForDelete = false,
    draftDiffersFromDefault = false,
    allVisibleSelected = false,
    someVisibleSelected = false,
    onMarkForDelete,
    onUnmarkDelete,
    onRemoveInsert,
    onClearDraft,
    onMarkAllVisible,
    onUnmarkAllVisible
}: {
    variant: "existing" | "insert" | "draft" | "header"
    markedForDelete?: boolean
    draftDiffersFromDefault?: boolean
    allVisibleSelected?: boolean
    someVisibleSelected?: boolean
    onMarkForDelete?: () => void
    onUnmarkDelete?: () => void
    onRemoveInsert?: () => void
    onClearDraft?: () => void
    onMarkAllVisible?: () => void
    onUnmarkAllVisible?: () => void
}) {
    if (variant === "header") {
        if (allVisibleSelected || someVisibleSelected) {
            return (
                <ActionColFrame>
                    <input
                        type="checkbox"
                        class="rows-grid__delete-checkbox"
                        checked={allVisibleSelected}
                        aria-label={
                            allVisibleSelected
                                ? "Unmark all visible rows for deletion"
                                : "Unmark selected rows for deletion"
                        }
                        ref={(element) => {
                            if (element) {
                                element.indeterminate = someVisibleSelected && !allVisibleSelected
                            }
                        }}
                        onChange={() => onUnmarkAllVisible?.()}
                    />
                </ActionColFrame>
            )
        }

        return (
            <ActionColFrame>
                <button
                    type="button"
                    class="rows-grid__action-btn"
                    aria-label="Mark all visible rows for deletion"
                    onMouseDown={preventFocusSteal}
                    onClick={() => onMarkAllVisible?.()}
                >
                    <TrashIcon />
                </button>
            </ActionColFrame>
        )
    }

    if (variant === "draft") {
        if (!draftDiffersFromDefault) {
            return <ActionColFrame />
        }
        return (
            <ActionColFrame>
                <button
                    type="button"
                    class="rows-grid__action-btn"
                    aria-label="Clear new row"
                    onMouseDown={preventFocusSteal}
                    onClick={() => onClearDraft?.()}
                >
                    <TrashIcon />
                </button>
            </ActionColFrame>
        )
    }

    if (variant === "insert") {
        return (
            <ActionColFrame>
                <button
                    type="button"
                    class="rows-grid__action-btn"
                    aria-label="Remove new row"
                    onMouseDown={preventFocusSteal}
                    onClick={() => onRemoveInsert?.()}
                >
                    <TrashIcon />
                </button>
            </ActionColFrame>
        )
    }

    if (markedForDelete) {
        return (
            <ActionColFrame>
                <input
                    type="checkbox"
                    class="rows-grid__delete-checkbox"
                    checked
                    aria-label="Unmark row for deletion"
                    onMouseDown={preventFocusSteal}
                    onChange={() => onUnmarkDelete?.()}
                />
            </ActionColFrame>
        )
    }

    return (
        <ActionColFrame>
            <button
                type="button"
                class="rows-grid__action-btn"
                aria-label="Mark row for deletion"
                onMouseDown={preventFocusSteal}
                onClick={() => onMarkForDelete?.()}
            >
                <TrashIcon />
            </button>
        </ActionColFrame>
    )
}
