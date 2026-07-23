export function ButtonSwitch({
    label,
    pressed,
    onPressedChange,
    disabled = false
}: {
    label: string
    pressed: boolean
    onPressedChange: (pressed: boolean) => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={pressed}
            aria-label={label}
            class={`button-switch${pressed ? " button-switch--on" : ""}`}
            disabled={disabled}
            onClick={() => onPressedChange(!pressed)}
        >
            {label}
        </button>
    )
}
