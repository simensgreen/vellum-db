import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
    assertTableDefinition,
    compileCreateTableSql,
    compileRowJsonSchema,
    type TableDefinition
} from "../src/core/table/index.ts"
import { closeDatabase, getDatabase, openDatabase, parseConfig } from "../src/db.ts"
import { validateRowAgainstSchema } from "../src/schema-validate.ts"

const authorsDefinition: TableDefinition = {
    slug: "authors",
    name: "Authors",
    columns: [
        {
            name: "Slug",
            slug: "author_slug",
            primaryKey: true,
            data: { type: "str" }
        },
        {
            name: "Name",
            slug: "name",
            data: { type: "str" }
        }
    ]
}

const postsDefinition: TableDefinition = {
    slug: "posts",
    name: "Posts",
    columns: [
        {
            name: "Slug",
            slug: "post_slug",
            primaryKey: true,
            data: { type: "str" }
        },
        {
            name: "Title",
            slug: "title",
            data: { type: "str", minLen: 1 }
        },
        {
            name: "Author",
            slug: "author_id",
            data: {
                type: "ref",
                table: "authors",
                column: "author_slug"
            }
        },
        {
            name: "Published",
            slug: "published",
            nullable: true,
            data: { type: "bool", default: false }
        },
        {
            name: "Status",
            slug: "status",
            data: { type: "enum", variants: ["draft", "published"], default: 0 }
        },
        {
            name: "Score",
            slug: "score",
            nullable: true,
            data: { type: "float", min: 0, max: 100 }
        },
        {
            name: "Payload",
            slug: "payload",
            nullable: true,
            data: {
                type: "json",
                schema: {
                    type: "object",
                    properties: {
                        source: { type: "string" }
                    },
                    required: ["source"],
                    additionalProperties: false
                }
            }
        }
    ]
}

function withTempDb(): string {
    const dir = mkdtempSync(join(tmpdir(), "vellum-table-dsl-"))
    openDatabase(dir, parseConfig({ maxRowsPerQuery: 100, rawSqlMode: "select-only" }))
    return dir
}

afterEach(() => {
    closeDatabase()
})

describe("table definition validate", () => {
    test("accepts valid definition", () => {
        const definition = assertTableDefinition(authorsDefinition)
        expect(definition.slug).toBe("authors")
    })

    test("rejects duplicate column slug", () => {
        expect(() =>
            assertTableDefinition({
                ...authorsDefinition,
                columns: [
                    ...authorsDefinition.columns,
                    { name: "Dup", slug: "author_slug", data: { type: "str" } }
                ]
            })
        ).toThrow('Duplicate column slug "author_slug"')
    })

    test("rejects when no primary key column", () => {
        expect(() =>
            assertTableDefinition({
                ...authorsDefinition,
                columns: authorsDefinition.columns.map((column) => ({
                    ...column,
                    primaryKey: false
                }))
            })
        ).toThrow("Primary key must include at least one column")
    })

    test("rejects bool without default", () => {
        expect(() =>
            assertTableDefinition({
                slug: "flags",
                name: "Flags",
                columns: [
                    { name: "Slug", slug: "flag_slug", primaryKey: true, data: { type: "str" } },
                    { name: "Active", slug: "active", data: { type: "bool" } }
                ]
            })
        ).toThrow("Invalid table definition")
    })

    test("rejects enum default out of range", () => {
        expect(() =>
            assertTableDefinition({
                slug: "bad_enum",
                name: "Bad Enum",
                columns: [
                    { name: "ID", slug: "id", primaryKey: true, data: { type: "str" } },
                    {
                        name: "Status",
                        slug: "status",
                        data: { type: "enum", variants: ["a"], default: 2 }
                    }
                ]
            })
        ).toThrow('Enum default index out of range for column "status"')
    })

    test("validates ref against known tables", () => {
        const knownTables = new Map<string, TableDefinition>([["authors", authorsDefinition]])
        expect(() => assertTableDefinition(postsDefinition, { knownTables })).not.toThrow()
    })

    test("rejects ref to non-pk column", () => {
        const knownTables = new Map<string, TableDefinition>([["authors", authorsDefinition]])
        expect(() =>
            assertTableDefinition(
                {
                    ...postsDefinition,
                    columns: [
                        ...postsDefinition.columns.filter((column) => column.slug !== "author_id"),
                        {
                            name: "Author",
                            slug: "author_id",
                            data: {
                                type: "ref",
                                table: "authors",
                                column: "name"
                            }
                        }
                    ]
                },
                { knownTables }
            )
        ).toThrow('must reference a primary key column on "authors"')
    })
})

describe("compileCreateTableSql", () => {
    test("generates text pk, unique, and foreign key", () => {
        const knownTables = new Map<string, TableDefinition>([["authors", authorsDefinition]])
        const sql = compileCreateTableSql(postsDefinition, { knownTables })
        expect(sql).toContain('CREATE TABLE "posts"')
        expect(sql).toContain('PRIMARY KEY ("post_slug")')
        expect(sql).toContain(
            'FOREIGN KEY ("author_id") REFERENCES "authors"("author_slug") ON DELETE RESTRICT ON UPDATE RESTRICT'
        )
    })

    test("generates inline integer primary key", () => {
        const definition: TableDefinition = {
            slug: "counters",
            name: "Counters",
            columns: [
                {
                    name: "ID",
                    slug: "counter_id",
                    primaryKey: true,
                    data: { type: "int" }
                },
                {
                    name: "Label",
                    slug: "label",
                    data: { type: "str" }
                }
            ]
        }
        const sql = compileCreateTableSql(definition)
        expect(sql).toContain('"counter_id" INTEGER PRIMARY KEY')
        expect(sql).not.toContain("PRIMARY KEY (")
    })

    test("generates composite primary key", () => {
        const definition: TableDefinition = {
            slug: "pairs",
            name: "Pairs",
            columns: [
                { name: "Left", slug: "left_id", primaryKey: true, data: { type: "str" } },
                { name: "Right", slug: "right_id", primaryKey: true, data: { type: "str" } }
            ]
        }
        const sql = compileCreateTableSql(definition)
        expect(sql).toContain('PRIMARY KEY ("left_id", "right_id")')
    })

    test("generates unique constraint", () => {
        const definition: TableDefinition = {
            slug: "users",
            name: "Users",
            columns: [
                { name: "Slug", slug: "user_slug", primaryKey: true, data: { type: "str" } },
                { name: "Email", slug: "email", unique: true, data: { type: "str" } }
            ]
        }
        const sql = compileCreateTableSql(definition)
        expect(sql).toContain('UNIQUE ("email")')
    })
})

describe("compileRowJsonSchema", () => {
    test("marks non-nullable columns as required", () => {
        const schema = compileRowJsonSchema(postsDefinition)
        expect(schema.required).toContain("post_slug")
        expect(schema.required).toContain("title")
        expect(schema.required).not.toContain("published")
    })

    test("compiles constraints and nested json schema", () => {
        const schema = compileRowJsonSchema(postsDefinition)
        const title = schema.properties?.title as Record<string, unknown>
        const payload = schema.properties?.payload as Record<string, unknown>
        expect(title.minLength).toBe(1)
        expect(payload.required).toEqual(["source"])
    })

    test("validates sample row through ajv", () => {
        const schema = compileRowJsonSchema(postsDefinition)
        const schemaJson = JSON.stringify(schema)
        validateRowAgainstSchema("posts", schemaJson, {
            post_slug: "hello",
            title: "Hello",
            author_id: "a1",
            status: "draft",
            payload: { source: "ui" }
        })
    })
})

describe("sqlite integration", () => {
    test("creates tables and enforces foreign key", () => {
        const dir = withTempDb()
        try {
            const knownTables = new Map<string, TableDefinition>([["authors", authorsDefinition]])
            const database = getDatabase()
            database.run(compileCreateTableSql(authorsDefinition))
            database.run(compileCreateTableSql(postsDefinition, { knownTables }))

            database
                .query('INSERT INTO "authors" ("author_slug", "name") VALUES (?, ?)')
                .run("a1", "Alice")
            database
                .query(
                    'INSERT INTO "posts" ("post_slug", "title", "author_id", "published", "status") VALUES (?, ?, ?, ?, ?)'
                )
                .run("p1", "Post", "a1", 0, "draft")

            expect(() =>
                database
                    .query(
                        'INSERT INTO "posts" ("post_slug", "title", "author_id", "published", "status") VALUES (?, ?, ?, ?, ?)'
                    )
                    .run("p2", "Bad", "missing", 0, "draft")
            ).toThrow()
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
})
