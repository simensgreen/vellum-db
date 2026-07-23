export type IntData = {
    type: "int"
    default?: number
    min?: number
    max?: number
    error?: string
}

export type FloatData = {
    type: "float"
    default?: number
    min?: number
    max?: number
    error?: string
}

export type StringData = {
    type: "str"
    default?: string
    minLen?: number
    maxLen?: number
    error?: string
    regex?: {
        regex: string
        error?: string
    }
}

export type NanoidDefault = { value: string } | "random"

export type NanoidData = {
    type: "nanoid"
    default: NanoidDefault
}

export type TimeStampDefaultValue = {
    value: string
}

export type TimeStampData = {
    type: "timestamp"
    default?: TimeStampDefaultValue | "now"
}

export type JSONData = {
    type: "json"
    default?: unknown
    schema?: Record<string, unknown>
}

export type BoolData = {
    type: "bool"
    default: boolean
}

export type EnumData = {
    type: "enum"
    variants: string[]
    default?: number
}

export type RefOnDelete = "cascade" | "restrict" | "set null"
export type RefOnUpdate = "cascade" | "restrict"

export type ReferenceData = {
    type: "ref"
    table: string
    column: string
    onDelete?: RefOnDelete
    onUpdate?: RefOnUpdate
}

export type ColumnData =
    | IntData
    | FloatData
    | StringData
    | NanoidData
    | TimeStampData
    | JSONData
    | BoolData
    | EnumData
    | ReferenceData

export type ColumnUiMode = "hidden" | "defaultHidden"

export type ColumnDefinition = {
    name: string
    slug: string
    uiMode?: ColumnUiMode
    description?: string
    nullable?: boolean
    unique?: boolean
    primaryKey?: boolean
    data: ColumnData
}

export type TableDefinition = {
    slug: string
    name: string
    description?: string
    scope?: string
    meta?: Record<string, unknown>
    columns: ColumnDefinition[]
}

export type SqlType = "TEXT" | "INTEGER" | "REAL"

export type InsertDefaultKind = "nanoid" | "now"

export type ForeignKeySpec = {
    table: string
    column: string
    onDelete: RefOnDelete
    onUpdate: RefOnUpdate
}

export type CompiledColumn = {
    slug: string
    sqlType: SqlType
    notNull: boolean
    jsonStored: boolean
    isPrimaryKey: boolean
    unique: boolean
    foreignKey?: ForeignKeySpec
    storageDefault?: string | number
    insertDefault?: InsertDefaultKind
}

export type CompileOptions = {
    knownTables?: Map<string, TableDefinition>
}

export function primaryKeySlugs(definition: TableDefinition): string[] {
    return definition.columns
        .filter((column) => column.primaryKey === true)
        .map((column) => column.slug)
}

export function primaryKeyColumnSet(definition: TableDefinition): Set<string> {
    return new Set(primaryKeySlugs(definition))
}
