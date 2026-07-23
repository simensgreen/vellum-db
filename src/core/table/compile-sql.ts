import { compileColumns, isSingleIntegerPrimaryKey } from "./compile-columns.ts"
import {
    type CompiledColumn,
    type CompileOptions,
    primaryKeySlugs,
    type TableDefinition
} from "./types.ts"

function quoteIdent(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`
}

function formatDefaultValue(column: CompiledColumn): string {
    const value = column.storageDefault
    if (typeof value === "number") {
        return String(value)
    }
    if (typeof value === "string") {
        return `'${value.replaceAll("'", "''")}'`
    }
    throw new Error(`Unsupported default for column "${column.slug}"`)
}

function formatColumnDefinition(column: CompiledColumn, inlineIntegerPrimaryKey: boolean): string {
    if (inlineIntegerPrimaryKey) {
        const parts = [`${quoteIdent(column.slug)} INTEGER PRIMARY KEY`]
        if (column.storageDefault !== undefined) {
            parts.push(`DEFAULT ${formatDefaultValue(column)}`)
        }
        return parts.join(" ")
    }

    const parts = [quoteIdent(column.slug), column.sqlType]
    if (column.notNull) {
        parts.push("NOT NULL")
    }
    if (column.storageDefault !== undefined) {
        parts.push(`DEFAULT ${formatDefaultValue(column)}`)
    }
    return parts.join(" ")
}

function formatPrimaryKeyClause(primaryKeySlugs: string[]): string {
    const quoted = primaryKeySlugs.map((slug) => quoteIdent(slug)).join(", ")
    return `PRIMARY KEY (${quoted})`
}

function formatUniqueClause(slug: string): string {
    return `UNIQUE (${quoteIdent(slug)})`
}

function formatForeignKeyClause(column: CompiledColumn): string {
    const foreignKey = column.foreignKey
    if (!foreignKey) {
        throw new Error(`Missing foreign key metadata for column "${column.slug}"`)
    }
    const onDelete = foreignKey.onDelete.toUpperCase()
    const onUpdate = foreignKey.onUpdate.toUpperCase()
    return (
        `FOREIGN KEY (${quoteIdent(column.slug)}) ` +
        `REFERENCES ${quoteIdent(foreignKey.table)}(${quoteIdent(foreignKey.column)}) ` +
        `ON DELETE ${onDelete} ON UPDATE ${onUpdate}`
    )
}

export function compileCreateTableSql(
    definition: TableDefinition,
    options: CompileOptions = {}
): string {
    const columns = compileColumns(definition, options)
    const inlineIntegerPrimaryKey = isSingleIntegerPrimaryKey(definition)
    const primaryKeySlugsList = primaryKeySlugs(definition)

    const definitions: string[] = []

    for (const column of columns) {
        const inlinePk = inlineIntegerPrimaryKey && column.isPrimaryKey
        definitions.push(formatColumnDefinition(column, inlinePk))
    }

    if (!inlineIntegerPrimaryKey && primaryKeySlugsList.length > 0) {
        definitions.push(formatPrimaryKeyClause(primaryKeySlugsList))
    }

    for (const column of columns) {
        if (column.unique && !column.isPrimaryKey) {
            definitions.push(formatUniqueClause(column.slug))
        }
    }

    for (const column of columns) {
        if (column.foreignKey) {
            definitions.push(formatForeignKeyClause(column))
        }
    }

    if (definitions.length === 0) {
        throw new Error("Table definition must compile to at least one column")
    }

    return `CREATE TABLE ${quoteIdent(definition.slug)} (${definitions.join(", ")})`
}
