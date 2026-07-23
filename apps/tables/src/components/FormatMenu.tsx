import type { ComponentChildren } from "preact"
import { useEffect, useRef } from "preact/hooks"

export type IoFormat = "csv" | "json" | "jsonl" | "xlsx"

const IO_FORMATS: IoFormat[] = ["csv", "json", "jsonl", "xlsx"]

export function FormatMenu({
    icon,
    ariaLabel,
    disabled = false,
    onSelect
}: {
    icon: ComponentChildren
    ariaLabel: string
    disabled?: boolean
    onSelect: (format: IoFormat) => void
}) {
    const detailsRef = useRef<HTMLDetailsElement>(null)

    useEffect(() => {
        function closeOnOutsideClick(event: MouseEvent): void {
            const detailsElement = detailsRef.current
            if (!detailsElement?.open) {
                return
            }
            if (event.target instanceof Node && detailsElement.contains(event.target)) {
                return
            }
            detailsElement.open = false
        }
        document.addEventListener("click", closeOnOutsideClick)
        return () => document.removeEventListener("click", closeOnOutsideClick)
    }, [])

    function handleSelect(format: IoFormat): void {
        onSelect(format)
        if (detailsRef.current) {
            detailsRef.current.open = false
        }
    }

    return (
        <details class="format-menu" ref={detailsRef}>
            <summary
                class={`v-button secondary format-menu__trigger${disabled ? " format-menu__trigger--disabled" : ""}`}
                aria-label={ariaLabel}
                title={ariaLabel}
            >
                {icon}
            </summary>
            <ul class="format-menu__list">
                {IO_FORMATS.map((format) => (
                    <li key={format} role="none">
                        <button
                            type="button"
                            class="format-menu__item"
                            role="menuitem"
                            disabled={disabled}
                            onClick={() => handleSelect(format)}
                        >
                            {format.toUpperCase()}
                        </button>
                    </li>
                ))}
            </ul>
        </details>
    )
}

export { IO_FORMATS }
