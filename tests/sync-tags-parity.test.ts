import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("sync-tags parity", () => {
    test("app sync-tags matches src/core/sync-tags.ts", () => {
        const root = join(import.meta.dir, "..")
        const source = readFileSync(join(root, "src/core/sync-tags.ts"), "utf8")
        const appCopy = readFileSync(join(root, "apps/tables/src/sync-tags.ts"), "utf8")
        expect(appCopy).toBe(source)
    })
})
