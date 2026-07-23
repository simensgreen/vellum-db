export type ToastVariant = "error" | "success" | "warning" | "info"

function toastContainer(): HTMLElement {
    let container = document.getElementById("v-toast-container")
    if (!container) {
        container = document.createElement("div")
        container.id = "v-toast-container"
        document.body.appendChild(container)
    }
    return container
}

export function showToast(message: string, variant: ToastVariant = "info"): void {
    const toast = document.createElement("div")
    toast.className = `v-toast ${variant}`
    toast.setAttribute("role", variant === "error" ? "alert" : "status")

    const text = document.createElement("span")
    text.textContent = message
    toast.append(text)

    const dismiss = document.createElement("button")
    dismiss.type = "button"
    dismiss.className = "v-toast-dismiss"
    dismiss.setAttribute("aria-label", "Dismiss")
    dismiss.textContent = "\u00d7"

    const timeoutId = window.setTimeout(() => {
        toast.remove()
    }, 6000)

    dismiss.addEventListener("click", () => {
        window.clearTimeout(timeoutId)
        toast.remove()
    })

    toast.append(dismiss)
    toastContainer().append(toast)
}

export function showToastError(message: string): void {
    showToast(message, "error")
}

export function showValidationToast(messages: string[]): void {
    if (messages.length === 0) {
        return
    }
    if (messages.length === 1) {
        showToastError(messages[0]!)
        return
    }
    const preview = messages.slice(0, 3).join("; ")
    const remaining = messages.length - 3
    const suffix = remaining > 0 ? ` (+${remaining} more)` : ""
    showToastError(`Fix ${messages.length} validation errors: ${preview}${suffix}`)
}
