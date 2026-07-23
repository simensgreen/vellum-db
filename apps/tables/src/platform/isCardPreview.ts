export function isCardPreview(): boolean {
    if (new URLSearchParams(location.search).has("preview")) {
        return true
    }
    const bridge = window.vellum
    if (!bridge) {
        return false
    }
    return typeof bridge.fetch !== "function"
}
