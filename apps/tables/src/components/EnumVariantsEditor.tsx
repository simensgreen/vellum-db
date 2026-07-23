import { useLayoutEffect, useRef } from "preact/hooks"
import { ButtonSwitch } from "./ButtonSwitch.tsx"
import { TrashIcon } from "./TrashIcon.tsx"

function adjustDefaultIndex(
    defaultIndex: number | undefined,
    removedIndex: number
): number | undefined {
    if (defaultIndex === undefined) {
        return undefined
    }
    if (defaultIndex === removedIndex) {
        return undefined
    }
    if (defaultIndex > removedIndex) {
        return defaultIndex - 1
    }
    return defaultIndex
}

export function EnumVariantsEditor({
    variants,
    defaultIndex,
    onChange
}: {
    variants: string[]
    defaultIndex?: number
    onChange: (variants: string[], defaultIndex?: number) => void
}) {
    const rows = [...variants, ""]
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])
    const focusAfterRender = useRef<{ index: number; cursor: number } | null>(null)

    useLayoutEffect(() => {
        const pending = focusAfterRender.current
        if (pending === null) {
            return
        }
        focusAfterRender.current = null
        const input = inputRefs.current[pending.index]
        if (input === null || input === undefined) {
            return
        }
        input.focus()
        input.setSelectionRange(pending.cursor, pending.cursor)
    })

    function rememberFocus(index: number, input: HTMLInputElement): void {
        focusAfterRender.current = { index, cursor: input.selectionStart ?? 0 }
    }

    function focusDraft(): void {
        const draftIndex = variants.length
        focusAfterRender.current = { index: draftIndex, cursor: 0 }
        const draftInput = inputRefs.current[draftIndex]
        draftInput?.focus()
    }

    function handleKeyDown(index: number, event: KeyboardEvent): void {
        if (event.key !== "Enter") {
            return
        }
        event.preventDefault()
        if (index === variants.length) {
            return
        }
        focusDraft()
    }

    function removeVariant(index: number): void {
        const next = variants.filter((_, variantIndex) => variantIndex !== index)
        onChange(next, adjustDefaultIndex(defaultIndex, index))
    }

    function handleInput(index: number, event: Event): void {
        const input = event.target as HTMLInputElement
        const value = input.value
        rememberFocus(index, input)

        if (index === variants.length) {
            if (value !== "") {
                onChange([...variants, value], defaultIndex)
            }
            return
        }
        if (value === "") {
            rememberFocus(Math.min(index, Math.max(0, variants.length - 2)), input)
            removeVariant(index)
            return
        }
        const next = variants.map((variant, variantIndex) =>
            variantIndex === index ? value : variant
        )
        onChange(next, defaultIndex)
    }

    return (
        <div class="enum-variants-editor column-type-fields__full">
            <span class="form-field__label">Variants</span>
            {rows.map((value, index) => {
                const isDraft = index === variants.length
                return (
                    <div
                        class={`enum-variants-editor__row${isDraft ? " enum-variants-editor__row--draft" : ""}`}
                        key={`enum-row-${index}`}
                    >
                        <input
                            type="text"
                            ref={(element) => {
                                inputRefs.current[index] = element
                            }}
                            value={value}
                            placeholder={isDraft ? "New variant" : "Variant name"}
                            onInput={(event) => handleInput(index, event)}
                            onKeyDown={(event) => handleKeyDown(index, event)}
                        />
                        {isDraft ? null : (
                            <>
                                <ButtonSwitch
                                    label="Default"
                                    pressed={defaultIndex === index}
                                    onPressedChange={(pressed) =>
                                        onChange(variants, pressed ? index : undefined)
                                    }
                                />
                                <button
                                    type="button"
                                    class="icon-remove-button"
                                    aria-label="Remove variant"
                                    onClick={() => removeVariant(index)}
                                >
                                    <TrashIcon />
                                </button>
                            </>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
