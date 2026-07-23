import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GET as queryRows } from "../routes/rows.ts"
import { DELETE as dropTableRoute } from "../routes/tables/drop.ts"
import { POST as createTableRoute, GET as listTables } from "../routes/tables.ts"
import { ensureMetaSchema } from "../src/core/catalog.ts"
import { closeDatabase, openDatabase, parseConfig } from "../src/db.ts"
import { tasksDefinition } from "./fixtures/table-definitions.ts"

function withTempDb(): string {
    const dir = mkdtempSync(join(tmpdir(), "vellum-db-routes-"))
    openDatabase(dir, parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only" }))
    ensureMetaSchema()
    return dir
}

afterEach(() => {
    closeDatabase()
})

describe("routes", () => {
    test("GET /tables lists empty catalog", async () => {
        const dir = withTempDb()
        try {
            const response = await listTables(new Request("http://local/tables"))
            expect(response.status).toBe(200)
            const body = (await response.json()) as {
                tables: unknown[]
                count: number
            }
            expect(body.tables).toEqual([])
            expect(body.count).toBe(0)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("POST /tables creates table; GET /rows returns rows", async () => {
        const dir = withTempDb()
        try {
            const createResponse = await createTableRoute(
                new Request("http://local/tables?scope=demo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(tasksDefinition)
                })
            )
            expect(createResponse.status).toBe(200)

            const listResponse = await listTables(new Request("http://local/tables"))
            const listBody = (await listResponse.json()) as {
                tables: Array<{ name: string; definition: { slug: string } }>
            }
            expect(listBody.tables).toHaveLength(1)
            expect(listBody.tables[0]?.name).toBe("tasks")
            expect(listBody.tables[0]?.definition.slug).toBe("tasks")

            const rowsResponse = await queryRows(
                new Request("http://local/rows?table=tasks&limit=10&offset=0")
            )
            expect(rowsResponse.status).toBe(200)
            const rowsBody = (await rowsResponse.json()) as {
                table: string
                rows: unknown[]
            }
            expect(rowsBody.table).toBe("tasks")
            expect(rowsBody.rows).toEqual([])
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("POST /tables requires scope query param", async () => {
        const dir = withTempDb()
        try {
            const response = await createTableRoute(
                new Request("http://local/tables", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(tasksDefinition)
                })
            )
            expect(response.status).toBe(400)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("POST /tables returns structured error for invalid body", async () => {
        const dir = withTempDb()
        try {
            const response = await createTableRoute(
                new Request("http://local/tables", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slug: "bad", columns: [] })
                })
            )
            expect(response.status).toBe(400)
            const body = (await response.json()) as {
                type: string
                msg?: string
                hint?: string
            }
            expect(body.type).toBeTruthy()
            expect(body.msg ?? body.hint).toBeTruthy()
            expect("error" in body).toBe(false)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("DELETE /tables/drop returns 403 when allowDropTable is false", async () => {
        const dir = withTempDb()
        try {
            const response = await dropTableRoute(
                new Request("http://local/tables/drop?table=missing", {
                    method: "DELETE"
                })
            )
            expect(response.status).toBe(403)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("GET /rows rejects missing table param", async () => {
        const dir = withTempDb()
        try {
            const response = await queryRows(new Request("http://local/rows"))
            expect(response.status).toBe(400)
            const body = (await response.json()) as { type: string; msg?: string }
            expect(body.type).toBe("validation_error")
            expect(body.msg).toContain("table")
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
})
