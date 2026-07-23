/// <reference lib="dom" />

declare global {
    interface Window {
        vellum?: {
            fetch: (path: string, options?: RequestInit) => Promise<Response>
            subscribe: (
                filter: { tags: readonly string[] },
                callback: (event: { tags?: string[] }) => void
            ) => () => void
        }
    }
}

export function isBridgeAvailable(): boolean {
    return typeof window.vellum?.fetch === "function"
}

export function vellumFetch(path: string, init?: RequestInit): Promise<Response> {
    if (typeof window.vellum?.fetch === "function") {
        return window.vellum.fetch(path, init)
    }
    return fetch(path, init)
}

export function vellumSubscribe(
    filter: { tags: readonly string[] },
    callback: (event: { tags?: string[] }) => void
): (() => void) | null {
    if (typeof window.vellum?.subscribe !== "function") {
        return null
    }
    return window.vellum.subscribe(filter, callback)
}
