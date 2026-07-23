import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createUserTable, ensureMetaSchema, listTables } from "../src/core/catalog.ts"
import { insertTableRow } from "../src/core/insert.ts"
import { executeQueryDefinition } from "../src/core/query.ts"
import type { TableDefinition } from "../src/core/table/types.ts"
import { extractViewParamNames, listViews, saveView } from "../src/core/views.ts"
import { runView } from "../src/core/views-api.ts"
import { closeDatabase, openDatabase, parseConfig } from "../src/db.ts"
import { tasksDefinition } from "./fixtures/table-definitions.ts"
import { TEST_TABLE_SCOPE } from "./fixtures/test-scope.ts"

const projectsDefinition: TableDefinition = {
    slug: "projects",
    name: "Projects",
    columns: [
        {
            name: "Project ID",
            slug: "project_id",
            primaryKey: true,
            data: { type: "nanoid", default: "random" }
        },
        {
            name: "Name",
            slug: "name",
            data: { type: "str", minLen: 1 }
        }
    ]
}

const tasksWithProjectDefinition: TableDefinition = {
    slug: "tasks",
    name: "Tasks",
    columns: [
        ...tasksDefinition.columns,
        {
            name: "Project",
            slug: "project_ref",
            data: { type: "ref", table: "projects", column: "project_id" }
        }
    ]
}

function withTempDb(): string {
    const dir = mkdtempSync(join(tmpdir(), "vellum-db-"))
    openDatabase(dir, parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only" }))
    ensureMetaSchema()
    return dir
}

afterEach(() => {
    closeDatabase()
})

describe("views", () => {
    test("extractViewParamNames collects unique placeholders", () => {
        expect(
            extractViewParamNames({
                table: "tasks",
                filter: { status: "$status", points: { gte: "$min_points" } }
            })
        ).toEqual(["min_points", "status"])
    })

    test("save list run view with params and scope filter", () => {
        const dir = withTempDb()
        try {
            createUserTable(tasksDefinition, { scope: TEST_TABLE_SCOPE })
            const table = listTables().tables[0]!
            insertTableRow(table, { title: "Open", status: "open", points: 3 })
            insertTableRow(table, { title: "Done", status: "done", points: 1 })

            saveView({
                slug: "tasks_by_status",
                name: "Tasks by status",
                kind: "query",
                scope: "analytics",
                definition: {
                    table: "tasks",
                    filter: { status: "$status" }
                }
            })
            saveView({
                slug: "all_tasks",
                name: "All tasks",
                kind: "query",
                scope: "general",
                definition: { table: "tasks" }
            })
            saveView({
                slug: "all_tasks",
                name: "All tasks",
                kind: "query",
                scope: null,
                definition: { table: "tasks" }
            })

            expect(listViews({ scope: "analytics" }).views.map((view) => view.slug)).toEqual([
                "tasks_by_status"
            ])
            expect(listViews({ scope: null }).views.map((view) => view.slug)).toEqual(["all_tasks"])

            const runResult = runView({
                slug: "tasks_by_status",
                params: { status: "done" }
            })
            expect(runResult.kind).toBe("query")
            expect(runResult.result.count).toBe(1)
            const firstRow = runResult.result.rows[0] as Record<string, unknown> | undefined
            expect(firstRow?.status).toBe("done")
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("query join exposes related column", () => {
        const dir = withTempDb()
        try {
            createUserTable(projectsDefinition, { scope: TEST_TABLE_SCOPE })
            createUserTable(tasksWithProjectDefinition, { scope: TEST_TABLE_SCOPE })
            const tasksTable = listTables().tables.find((table) => table.name === "tasks")!
            const projectRow = insertTableRow(
                listTables().tables.find((table) => table.name === "projects")!,
                { name: "Website" }
            )
            insertTableRow(tasksTable, {
                title: "Ship feature",
                status: "open",
                points: 5,
                project_ref: projectRow.id
            })

            const result = executeQueryDefinition({
                table: "tasks",
                joins: [{ ref: "project_ref", select: { name: "project_name" } }],
                columns: ["task_id", "title", "project_name"]
            })

            expect(result.count).toBe(1)
            expect(result.rows[0]?.project_name).toBe("Website")
            expect(result.rows[0]?.title).toBe("Ship feature")
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("view with join runs saved definition", () => {
        const dir = withTempDb()
        try {
            createUserTable(projectsDefinition, { scope: TEST_TABLE_SCOPE })
            createUserTable(tasksWithProjectDefinition, { scope: TEST_TABLE_SCOPE })
            const tasksTable = listTables().tables.find((table) => table.name === "tasks")!
            const projectRow = insertTableRow(
                listTables().tables.find((table) => table.name === "projects")!,
                { name: "Mobile app" }
            )
            insertTableRow(tasksTable, {
                title: "Fix crash",
                status: "done",
                points: 2,
                project_ref: projectRow.id
            })

            saveView({
                slug: "tasks_with_project",
                name: "Tasks with project",
                kind: "query",
                scope: TEST_TABLE_SCOPE,
                definition: {
                    table: "tasks",
                    joins: [{ ref: "project_ref", select: { name: "project_name" } }],
                    columns: ["title", "project_name"]
                }
            })

            const runResult = runView({ slug: "tasks_with_project" })
            expect(runResult.kind).toBe("query")
            expect(runResult.result.rows[0]?.project_name).toBe("Mobile app")
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
})
