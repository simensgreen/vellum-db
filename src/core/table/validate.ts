import Ajv from "ajv"
import { ApiError } from "../../api/errors.ts"
import { assertSafeIdentifier } from "../../identifiers.ts"
import { formatAjvErrors } from "../../schema-validate.ts"
import { tableDefinitionMetaSchema } from "./meta-schema.ts"
import {
    type ColumnDefinition,
    type CompileOptions,
    primaryKeyColumnSet,
    type TableDefinition
} from "./types.ts"

const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateSchema: false
})

const validateTableDefinitionFn = ajv.compile(tableDefinitionMetaSchema)

function primaryKeySet(definition: TableDefinition): Set<string> {
    return primaryKeyColumnSet(definition)
}

function findColumn(definition: TableDefinition, slug: string): ColumnDefinition | undefined {
    return definition.columns.find((column) => column.slug === slug)
}

function resolveSqlTypeForColumn(column: ColumnDefinition): "TEXT" | "INTEGER" | "REAL" {
    switch (column.data.type) {
        case "int":
            return "INTEGER"
        case "float":
            return "REAL"
        case "bool":
            return "INTEGER"
        case "json":
            return "TEXT"
        default:
            return "TEXT"
    }
}

function semanticError(msg: string, hint: string): never {
    throw new ApiError("invalid_table_definition", msg, { hint })
}

export function validateTableDefinitionSemantics(
    definition: TableDefinition,
    options: CompileOptions = {}
): void {
    try {
        assertSafeIdentifier(definition.slug, "table")
    } catch {
        semanticError(`Invalid table slug "${definition.slug}"`, "slug must match [a-z][a-z0-9_]*")
    }

    if (definition.scope !== undefined && definition.scope !== "") {
        try {
            assertSafeIdentifier(definition.scope, "query")
        } catch {
            semanticError(`Invalid scope "${definition.scope}"`, "scope must match [a-z][a-z0-9_]*")
        }
    }

    const seenSlugs = new Set<string>()
    for (const column of definition.columns) {
        try {
            assertSafeIdentifier(column.slug, "column")
        } catch {
            semanticError(
                `Invalid column slug "${column.slug}"`,
                "column slug must match [a-z][a-z0-9_]*"
            )
        }
        if (seenSlugs.has(column.slug)) {
            semanticError(
                `Duplicate column slug "${column.slug}"`,
                "Each column slug must be unique within the table"
            )
        }
        seenSlugs.add(column.slug)
    }

    const primaryKeys = primaryKeySet(definition)
    if (primaryKeys.size === 0) {
        semanticError(
            "Primary key must include at least one column",
            "Set primaryKey: true on at least one column"
        )
    }

    for (const column of definition.columns) {
        if (column.primaryKey !== true) {
            continue
        }
        if (column.nullable === true) {
            semanticError(
                `Primary key column "${column.slug}" must not be nullable`,
                "Remove nullable: true from primary key columns"
            )
        }
    }

    for (const column of definition.columns) {
        const data = column.data

        if (data.type === "enum") {
            if (data.variants.length === 0) {
                semanticError(
                    `Enum column "${column.slug}" must have at least one variant`,
                    "Add at least one string variant to enum columns"
                )
            }
            if (
                data.default !== undefined &&
                (data.default < 0 || data.default >= data.variants.length)
            ) {
                semanticError(
                    `Enum default index out of range for column "${column.slug}"`,
                    "Set default to a valid variant index"
                )
            }
        }

        if (data.type === "ref") {
            try {
                assertSafeIdentifier(data.table, "table")
                assertSafeIdentifier(data.column, "column")
            } catch {
                semanticError(
                    `Invalid ref target on column "${column.slug}"`,
                    "ref.table and ref.column must match [a-z][a-z0-9_]*"
                )
            }

            if (data.onDelete === "set null" && column.nullable !== true) {
                semanticError(
                    `Ref column "${column.slug}" with onDelete "set null" must be nullable`,
                    "Set nullable: true or change onDelete"
                )
            }

            const knownTables = options.knownTables
            if (knownTables) {
                const target = knownTables.get(data.table)
                if (!target) {
                    semanticError(
                        `Ref column "${column.slug}" references unknown table "${data.table}"`,
                        "Create the referenced table first or fix ref.table"
                    )
                }
                const targetColumn = findColumn(target, data.column)
                if (!targetColumn) {
                    semanticError(
                        `Ref column "${column.slug}" references unknown column "${data.column}" on table "${data.table}"`,
                        "ref.column must exist on the referenced table"
                    )
                }
                if (!targetColumn.primaryKey) {
                    semanticError(
                        `Ref column "${column.slug}" must reference a primary key column on "${data.table}"`,
                        `Ref column "${column.slug}" must reference a primary key column on "${data.table}"`
                    )
                }
            }
        }
    }
}

export function assertTableDefinition(
    input: unknown,
    options: CompileOptions = {}
): TableDefinition {
    if (!validateTableDefinitionFn(input)) {
        const detail = formatAjvErrors(validateTableDefinitionFn.errors)
        throw new ApiError("validation_error", `Invalid table definition: ${detail}`, {
            hint: "Fix structural errors in the TableDefinition JSON"
        })
    }

    const definition = input as TableDefinition
    validateTableDefinitionSemantics(definition, options)
    return definition
}

export function inferRefSqlType(
    refTable: string,
    refColumn: string,
    knownTables: Map<string, TableDefinition> | undefined
): "TEXT" | "INTEGER" | "REAL" {
    if (!knownTables) {
        return "TEXT"
    }
    const target = knownTables.get(refTable)
    if (!target) {
        return "TEXT"
    }
    const column = findColumn(target, refColumn)
    if (!column) {
        return "TEXT"
    }
    return resolveSqlTypeForColumn(column)
}
