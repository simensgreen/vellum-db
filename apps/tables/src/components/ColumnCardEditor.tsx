import type { ColumnData } from "vellum-db/core/table/types"
import type { RefTarget, VisualColumn } from "../table-definition-editor/types.ts"
import { ButtonSwitch } from "./ButtonSwitch.tsx"
import { ColumnTypeFields } from "./ColumnTypeFields.tsx"
import { FormFieldLabel } from "./FormFieldLabel.tsx"
import { TrashIcon } from "./TrashIcon.tsx"

export function ColumnCardEditor({
    column,
    isDraft = false,
    nameInputRef,
    refTargets,
    onUpdate,
    onRemove
}: {
    column: VisualColumn
    isDraft?: boolean
    nameInputRef?: (element: HTMLInputElement | null) => void
    refTargets: RefTarget[]
    onUpdate: (patch: Partial<VisualColumn>) => void
    onRemove?: () => void
}) {
    return (
        <div class={`column-card${isDraft ? " column-card--draft" : ""}`}>
            <div class="column-card__header">
                <div class="column-card__switches">
                    <ButtonSwitch
                        label="Primary key"
                        pressed={column.primaryKey}
                        disabled={column.systemId}
                        onPressedChange={(pressed) => onUpdate({ primaryKey: pressed })}
                    />
                    <ButtonSwitch
                        label="Nullable"
                        pressed={column.nullable}
                        disabled={column.primaryKey}
                        onPressedChange={(pressed) => onUpdate({ nullable: pressed })}
                    />
                    <ButtonSwitch
                        label="Unique"
                        pressed={column.unique}
                        disabled={column.systemId}
                        onPressedChange={(pressed) => onUpdate({ unique: pressed })}
                    />
                </div>
                {!isDraft && !column.systemId && onRemove ? (
                    <button
                        type="button"
                        class="icon-remove-button"
                        aria-label="Remove column"
                        onClick={onRemove}
                    >
                        <TrashIcon />
                    </button>
                ) : null}
            </div>
            <label class="form-field">
                <FormFieldLabel required={!column.systemId && !isDraft}>Name</FormFieldLabel>
                <input
                    type="text"
                    ref={nameInputRef}
                    value={column.name}
                    onInput={(event) =>
                        onUpdate({ name: (event.target as HTMLInputElement).value })
                    }
                    placeholder={isDraft ? "New column" : "Title"}
                />
            </label>
            <label class="form-field">
                <FormFieldLabel required={!isDraft}>Slug</FormFieldLabel>
                <input
                    type="text"
                    value={column.slug}
                    onInput={(event) =>
                        onUpdate({
                            slug: (event.target as HTMLInputElement).value,
                            slugDirty: true
                        })
                    }
                    placeholder="title"
                />
            </label>
            <ColumnTypeFields
                data={column.data}
                refTargets={refTargets}
                onChange={(data: ColumnData) => onUpdate({ data })}
            />
        </div>
    )
}
