import type { ColumnData } from "vellum-db/core/table/types"
import type { VisualColumn, VisualTable } from "./types.ts"

export function defaultColumnData(type: ColumnData["type"]): ColumnData {
    switch (type) {
        case "bool":
            return { type: "bool", default: false }
        case "enum":
            return { type: "enum", variants: [] }
        case "int":
            return { type: "int" }
        case "float":
            return { type: "float" }
        case "timestamp":
            return { type: "timestamp", default: "now" }
        case "json":
            return { type: "json" }
        case "ref":
            return { type: "ref", table: "", column: "" }
        case "nanoid":
            return { type: "nanoid", default: "random" }
        default:
            return { type: "str" }
    }
}

export function systemIdVisualColumn(): VisualColumn {
    return {
        key: crypto.randomUUID(),
        name: "id",
        slug: "id",
        slugDirty: true,
        description: "",
        nullable: false,
        unique: true,
        primaryKey: true,
        systemId: true,
        data: { type: "nanoid", default: "random" }
    }
}

export function emptyVisualColumn(options: { primaryKey?: boolean } = {}): VisualColumn {
    const primaryKey = options.primaryKey ?? false
    return {
        key: crypto.randomUUID(),
        name: "",
        slug: "",
        slugDirty: false,
        description: "",
        nullable: false,
        unique: false,
        primaryKey,
        data: { type: "nanoid", default: "random" }
    }
}

export function emptyVisualTable(): VisualTable {
    return {
        name: "",
        slug: "",
        slugDirty: false,
        description: "",
        scope: "",
        columns: [systemIdVisualColumn()]
    }
}
