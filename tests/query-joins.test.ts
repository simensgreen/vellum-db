import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { executeAggregateDefinition } from "../src/core/aggregate.ts"
import { createUserTable, ensureMetaSchema, listTables } from "../src/core/catalog.ts"
import { insertTableRow } from "../src/core/insert.ts"
import { executeQueryDefinition } from "../src/core/query.ts"
import type { TableDefinition } from "../src/core/table/types.ts"
import { saveView } from "../src/core/views.ts"
import { runView } from "../src/core/views-api.ts"
import { closeDatabase, openDatabase, parseConfig } from "../src/db.ts"
import { TEST_TABLE_SCOPE } from "./fixtures/test-scope.ts"

const regionsDefinition: TableDefinition = {
    slug: "regions",
    name: "Regions",
    columns: [
        {
            name: "Region ID",
            slug: "region_id",
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
        },
        {
            name: "Region",
            slug: "region_ref",
            data: { type: "ref", table: "regions", column: "region_id" }
        }
    ]
}

const tasksDefinition: TableDefinition = {
    slug: "tasks",
    name: "Tasks",
    columns: [
        {
            name: "Task ID",
            slug: "task_id",
            primaryKey: true,
            data: { type: "nanoid", default: "random" }
        },
        {
            name: "Title",
            slug: "title",
            data: { type: "str", minLen: 1 }
        },
        {
            name: "Status",
            slug: "status",
            data: { type: "str" }
        },
        {
            name: "Points",
            slug: "points",
            data: { type: "int", min: 0 }
        },
        {
            name: "Project",
            slug: "project_ref",
            data: { type: "ref", table: "projects", column: "project_id" }
        }
    ]
}

function withTempDb(): string {
    const dir = mkdtempSync(join(tmpdir(), "vellum-db-joins-"))
    openDatabase(dir, parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only" }))
    ensureMetaSchema()
    return dir
}

function seedWorkGraph(): {
    orphanProjectId: string
    linkedProjectId: string
} {
    createUserTable(regionsDefinition, { scope: TEST_TABLE_SCOPE })
    createUserTable(projectsDefinition, { scope: TEST_TABLE_SCOPE })
    createUserTable(tasksDefinition, { scope: TEST_TABLE_SCOPE })

    const regionsTable = listTables().tables.find((table) => table.name === "regions")!
    const projectsTable = listTables().tables.find((table) => table.name === "projects")!
    const tasksTable = listTables().tables.find((table) => table.name === "tasks")!

    const europe = insertTableRow(regionsTable, { name: "Europe" })
    const linkedProject = insertTableRow(projectsTable, {
        name: "Website",
        region_ref: europe.id
    })
    const orphanProject = insertTableRow(projectsTable, {
        name: "Legacy",
        region_ref: europe.id
    })

    insertTableRow(tasksTable, {
        title: "Ship",
        status: "open",
        points: 5,
        project_ref: linkedProject.id
    })
    insertTableRow(tasksTable, {
        title: "Review",
        status: "done",
        points: 2,
        project_ref: linkedProject.id
    })

    return {
        orphanProjectId: orphanProject.id,
        linkedProjectId: linkedProject.id
    }
}

afterEach(() => {
    closeDatabase()
})

describe("query joins", () => {
    test("inner join excludes rows without a match", () => {
        const dir = withTempDb()
        try {
            seedWorkGraph()
            const leftResult = executeQueryDefinition({
                table: "tasks",
                joins: [{ ref: "project_ref", select: { name: "project_name" } }],
                columns: ["title", "project_name"]
            })
            const innerResult = executeQueryDefinition({
                table: "tasks",
                joins: [
                    {
                        ref: "project_ref",
                        type: "inner",
                        select: { name: "project_name" }
                    }
                ],
                columns: ["title", "project_name"]
            })

            expect(leftResult.count).toBe(2)
            expect(innerResult.count).toBe(2)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("right join includes parent rows without children", () => {
        const dir = withTempDb()
        try {
            const graph = seedWorkGraph()
            const result = executeQueryDefinition({
                table: "tasks",
                joins: [
                    {
                        ref: "project_ref",
                        type: "right",
                        select: {
                            name: "project_name",
                            project_id: "project_id"
                        }
                    }
                ],
                columns: ["title", "project_name", "project_id"]
            })

            const orphanRow = result.rows.find((row) => row.project_id === graph.orphanProjectId)
            expect(orphanRow).toBeDefined()
            expect(orphanRow?.title).toBeNull()
            expect(orphanRow?.project_name).toBe("Legacy")
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("multi-hop join resolves source table chain", () => {
        const dir = withTempDb()
        try {
            seedWorkGraph()
            const result = executeQueryDefinition({
                table: "tasks",
                joins: [
                    { ref: "project_ref", select: { name: "project_name" } },
                    {
                        source: "projects",
                        ref: "region_ref",
                        select: { name: "region_name" }
                    }
                ],
                columns: ["title", "project_name", "region_name"]
            })

            expect(result.count).toBe(2)
            expect(result.rows.every((row) => row.region_name === "Europe")).toBe(true)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("unknown join source fails validation at compile time", () => {
        const dir = withTempDb()
        try {
            seedWorkGraph()
            expect(() =>
                executeQueryDefinition({
                    table: "tasks",
                    joins: [
                        {
                            source: "regions",
                            ref: "region_ref",
                            select: { name: "region_name" }
                        }
                    ]
                })
            ).toThrow('Unknown join source table "regions"')
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
})

describe("aggregate joins", () => {
    test("join group_by filter having order and limit", () => {
        const dir = withTempDb()
        try {
            seedWorkGraph()
            const result = executeAggregateDefinition({
                table: "tasks",
                joins: [
                    {
                        ref: "project_ref",
                        type: "inner",
                        select: { name: "project_name" }
                    }
                ],
                metrics: [
                    { fn: "count", as: "task_count" },
                    { fn: "sum", column: "points", as: "total_points" }
                ],
                group_by: ["project_name"],
                filter: { status: { ne: "done" } },
                having: { total_points: { gte: 3 } },
                order: [{ column: "total_points", direction: "desc" }],
                limit: 10
            })

            expect(result.count).toBe(1)
            expect(result.rows[0]?.project_name).toBe("Website")
            expect(result.rows[0]?.total_points).toBe(5)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("metric column must come from base table", () => {
        const dir = withTempDb()
        try {
            seedWorkGraph()
            expect(() =>
                executeAggregateDefinition({
                    table: "tasks",
                    joins: [{ ref: "project_ref", select: { name: "project_name" } }],
                    metrics: [{ fn: "sum", column: "project_name", as: "bad" }]
                })
            ).toThrow('Unknown metric column "project_name"')
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    test("saved aggregate view with join runs end-to-end", () => {
        const dir = withTempDb()
        try {
            seedWorkGraph()
            saveView({
                slug: "points_by_project",
                name: "Points by project",
                kind: "aggregate",
                scope: TEST_TABLE_SCOPE,
                definition: {
                    table: "tasks",
                    joins: [{ ref: "project_ref", select: { name: "project_name" } }],
                    metrics: [{ fn: "sum", column: "points", as: "total_points" }],
                    group_by: ["project_name"]
                }
            })

            const runResult = runView({ slug: "points_by_project" })
            expect(runResult.kind).toBe("aggregate")
            expect(runResult.result.rows.length).toBeGreaterThan(0)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
})
