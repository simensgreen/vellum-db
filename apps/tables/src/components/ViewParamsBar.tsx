export function ViewParamsBar({
    paramNames,
    values,
    onChange,
    onRun,
    running
}: {
    paramNames: string[]
    values: Record<string, string>
    onChange: (paramName: string, value: string) => void
    onRun: () => void
    running: boolean
}) {
    if (paramNames.length === 0) {
        return null
    }

    return (
        <form
            class="view-params-bar v-card"
            onSubmit={(event) => {
                event.preventDefault()
                onRun()
            }}
        >
            <div class="view-params-bar__fields">
                {paramNames.map((paramName) => (
                    <label key={paramName} class="view-params-bar__field">
                        <span class="view-params-bar__label">{paramName}</span>
                        <input
                            type="text"
                            class="v-input"
                            value={values[paramName] ?? ""}
                            onInput={(event) =>
                                onChange(paramName, (event.target as HTMLInputElement).value)
                            }
                        />
                    </label>
                ))}
            </div>
            <button type="submit" class="v-button" disabled={running}>
                {running ? "Running…" : "Run"}
            </button>
        </form>
    )
}
