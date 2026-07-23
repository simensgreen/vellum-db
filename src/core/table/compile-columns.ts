import {
    type ColumnDefinition,
    type CompiledColumn,
    type CompileOptions,
    primaryKeySlugs,
    type SqlType,
    type TableDefinition
} from "./types.ts"
import { inferRefSqlType } from "./validate.ts"

function resolveStorageDefault(
    column: ColumnDefinition
): Pick<CompiledColumn, "storageDefault" | "insertDefault"> {
    const data = column.data

    switch (data.type) {
        case "int":
            return data.default !== undefined ? { storageDefault: data.default } : {}
        case "float":
            return data.default !== undefined ? { storageDefault: data.default } : {}
        case "bool":
            return { storageDefault: data.default ? 1 : 0 }
        case "str":
            if (data.default === undefined) {
                return {}
            }
            return { storageDefault: data.default }
        case "nanoid":
            if (data.default === "random") {
                return { insertDefault: "nanoid" }
            }
            return { storageDefault: data.default.value }
        case "timestamp":
            if (data.default === undefined) {
                return {}
            }
            if (data.default === "now") {
                return { insertDefault: "now" }
            }
            return { storageDefault: data.default.value }
        case "enum":
            if (data.default === undefined) {
                return {}
            }
            return { storageDefault: data.variants[data.default]! }
        case "json":
        case "ref":
            return {}
    }
}

function resolveSqlType(
    column: ColumnDefinition,
    options: CompileOptions
): { sqlType: SqlType; jsonStored: boolean } {
    switch (column.data.type) {
        case "int":
            return { sqlType: "INTEGER", jsonStored: false }
        case "float":
            return { sqlType: "REAL", jsonStored: false }
        case "bool":
            return { sqlType: "INTEGER", jsonStored: false }
        case "json":
            return { sqlType: "TEXT", jsonStored: true }
        case "nanoid":
            return { sqlType: "TEXT", jsonStored: false }
        case "ref":
            return {
                sqlType: inferRefSqlType(
                    column.data.table,
                    column.data.column,
                    options.knownTables
                ),
                jsonStored: false
            }
        default:
            return { sqlType: "TEXT", jsonStored: false }
    }
}

export function compileColumns(
    definition: TableDefinition,
    options: CompileOptions = {}
): CompiledColumn[] {
    return definition.columns.map((column) => {
        const { sqlType, jsonStored } = resolveSqlType(column, options)
        const isPrimaryKey = column.primaryKey === true
        const notNull = isPrimaryKey || column.nullable !== true
        const defaults = resolveStorageDefault(column)

        const compiled: CompiledColumn = {
            slug: column.slug,
            sqlType,
            notNull,
            jsonStored,
            isPrimaryKey,
            unique: column.unique === true,
            ...defaults
        }

        if (column.data.type === "ref") {
            compiled.foreignKey = {
                table: column.data.table,
                column: column.data.column,
                onDelete: column.data.onDelete ?? "restrict",
                onUpdate: column.data.onUpdate ?? "restrict"
            }
        }

        return compiled
    })
}

export function isSingleIntegerPrimaryKey(definition: TableDefinition): boolean {
    const primaryKeys = primaryKeySlugs(definition)
    if (primaryKeys.length !== 1) {
        return false
    }
    // validateTableDefinitionSemantics requires at least one primary key column.
    const pkSlug = primaryKeys[0]!
    const column = definition.columns.find((entry) => entry.slug === pkSlug)
    return column?.data.type === "int"
}
