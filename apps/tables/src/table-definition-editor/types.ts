import { type ColumnData, primaryKeySlugs, type TableDefinition } from "vellum-db/core/table/types"

export type VisualColumn = {
    key: string
    name: string
    slug: string
    slugDirty: boolean
    description: string
    nullable: boolean
    unique: boolean
    primaryKey: boolean
    systemId?: boolean
    data: ColumnData
}

export type VisualTable = {
    name: string
    slug: string
    slugDirty: boolean
    description: string
    scope: string
    columns: VisualColumn[]
}

export type RefTarget = {
    tableSlug: string
    pkColumns: string[]
    label: string
}

export type VisualColumnType = ColumnData["type"]

export const VISUAL_COLUMN_TYPES: VisualColumnType[] = [
    "nanoid",
    "str",
    "int",
    "float",
    "bool",
    "enum",
    "timestamp",
    "json",
    "ref"
]

export const VISUAL_COLUMN_TYPE_LABELS: Record<VisualColumnType, string> = {
    nanoid: "Nanoid",
    str: "String",
    int: "Integer",
    float: "Float",
    bool: "Boolean",
    enum: "Enum",
    timestamp: "Timestamp",
    json: "JSON",
    ref: "Reference"
}

export function refTargetsFromDefinitions(definitions: TableDefinition[]): RefTarget[] {
    return definitions.map((definition) => ({
        tableSlug: definition.slug,
        pkColumns: primaryKeySlugs(definition),
        label: definition.name || definition.slug
    }))
}
