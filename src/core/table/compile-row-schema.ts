import type { JsonSchemaObject } from "../../schema-validate.ts"
import type { ColumnDefinition, CompileOptions, TableDefinition } from "./types.ts"

function compileColumnPropertySchema(column: ColumnDefinition): JsonSchemaObject {
    const data = column.data

    switch (data.type) {
        case "int": {
            const schema: JsonSchemaObject = { type: "integer" }
            if (data.min !== undefined) {
                schema.minimum = data.min
            }
            if (data.max !== undefined) {
                schema.maximum = data.max
            }
            return schema
        }
        case "float": {
            const schema: JsonSchemaObject = { type: "number" }
            if (data.min !== undefined) {
                schema.minimum = data.min
            }
            if (data.max !== undefined) {
                schema.maximum = data.max
            }
            return schema
        }
        case "bool":
            return { type: "boolean", default: data.default }
        case "str": {
            const schema: JsonSchemaObject = { type: "string" }
            if (data.minLen !== undefined) {
                schema.minLength = data.minLen
            }
            if (data.maxLen !== undefined) {
                schema.maxLength = data.maxLen
            }
            if (data.regex?.regex) {
                schema.pattern = data.regex.regex
            }
            if (data.default !== undefined) {
                schema.default = data.default
            }
            return schema
        }
        case "nanoid": {
            const schema: JsonSchemaObject = {
                type: "string",
                pattern: "^[A-Za-z0-9_-]{1,64}$"
            }
            if (data.default !== "random") {
                schema.default = data.default.value
            }
            return schema
        }
        case "timestamp": {
            const schema: JsonSchemaObject = { type: "string", format: "date-time" }
            if (data.default !== undefined && data.default !== "now") {
                schema.default = data.default.value
            }
            return schema
        }
        case "enum": {
            const schema: JsonSchemaObject = { type: "string", enum: data.variants }
            if (data.default !== undefined) {
                schema.default = data.variants[data.default]
            }
            return schema
        }
        case "json":
            if (data.schema && typeof data.schema === "object") {
                return { ...data.schema } as JsonSchemaObject
            }
            return { type: ["object", "array"] }
        case "ref":
            return { type: "string", minLength: 1 }
    }
}

export function compileRowJsonSchema(
    definition: TableDefinition,
    _options: CompileOptions = {}
): JsonSchemaObject {
    const properties: Record<string, JsonSchemaObject> = {}
    const required: string[] = []

    for (const column of definition.columns) {
        properties[column.slug] = compileColumnPropertySchema(column)
        if (column.nullable !== true) {
            required.push(column.slug)
        }
    }

    const schema: JsonSchemaObject = {
        type: "object",
        properties,
        additionalProperties: false
    }

    if (required.length > 0) {
        schema.required = required
    }

    return schema
}
