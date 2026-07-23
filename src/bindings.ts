import type { SQLQueryBindings } from "bun:sqlite"

export function asBindings(values: readonly unknown[]): SQLQueryBindings[] {
    return values as SQLQueryBindings[]
}
