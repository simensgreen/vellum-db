import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import "../src/openapi/zod.ts"
import { buildOpenApiDocument, serializeOpenApiDocument } from "../src/openapi/build.ts"
import { registeredRoutePaths } from "../src/openapi/registry.ts"

const repoRoot = join(import.meta.dir, "..")
const committedPath = join(repoRoot, "openapi.json")

describe("openapi", () => {
    test("registry covers every route file", () => {
        const document = buildOpenApiDocument()
        const documentPaths = Object.keys(document.paths ?? {}).sort()
        expect(documentPaths).toEqual([...registeredRoutePaths].sort())
    })

    test("committed openapi.json matches generator output", () => {
        const generated = serializeOpenApiDocument(buildOpenApiDocument())
        const committed = readFileSync(committedPath, "utf8")
        expect(committed).toBe(generated)
    })
})
