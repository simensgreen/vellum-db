import type { JsonSchemaObject } from "../../schema-validate.ts"

const identifierPattern = "^[a-z][a-z0-9_]*$"

const intDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "int" },
        default: { type: "number" },
        min: { type: "number" },
        max: { type: "number" },
        error: { type: "string" }
    },
    required: ["type"],
    additionalProperties: false
}

const floatDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "float" },
        default: { type: "number" },
        min: { type: "number" },
        max: { type: "number" },
        error: { type: "string" }
    },
    required: ["type"],
    additionalProperties: false
}

const strDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "str" },
        default: { type: "string" },
        minLen: { type: "integer", minimum: 0 },
        maxLen: { type: "integer", minimum: 0 },
        error: { type: "string" },
        regex: {
            type: "object",
            properties: {
                regex: { type: "string" },
                error: { type: "string" }
            },
            required: ["regex"],
            additionalProperties: false
        }
    },
    required: ["type"],
    additionalProperties: false
}

const nanoidDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "nanoid" },
        default: {
            oneOf: [
                {
                    type: "object",
                    properties: { value: { type: "string" } },
                    required: ["value"],
                    additionalProperties: false
                },
                { const: "random" }
            ]
        }
    },
    required: ["type", "default"],
    additionalProperties: false
}

const timestampDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "timestamp" },
        default: {
            oneOf: [
                {
                    type: "object",
                    properties: { value: { type: "string" } },
                    required: ["value"],
                    additionalProperties: false
                },
                { const: "now" }
            ]
        }
    },
    required: ["type"],
    additionalProperties: false
}

const jsonDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "json" },
        default: {},
        schema: { type: "object" }
    },
    required: ["type"],
    additionalProperties: false
}

const boolDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "bool" },
        default: { type: "boolean" }
    },
    required: ["type", "default"],
    additionalProperties: false
}

const enumDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "enum" },
        variants: {
            type: "array",
            items: { type: "string" },
            minItems: 1
        },
        default: { type: "integer", minimum: 0 }
    },
    required: ["type", "variants"],
    additionalProperties: false
}

const refDataSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        type: { const: "ref" },
        table: { type: "string", pattern: identifierPattern },
        column: { type: "string", pattern: identifierPattern },
        onDelete: { enum: ["cascade", "restrict", "set null"] },
        onUpdate: { enum: ["cascade", "restrict"] }
    },
    required: ["type", "table", "column"],
    additionalProperties: false
}

const columnSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        name: { type: "string", minLength: 1 },
        slug: { type: "string", pattern: identifierPattern },
        uiMode: { enum: ["hidden", "defaultHidden"] },
        description: { type: "string" },
        nullable: { type: "boolean" },
        unique: { type: "boolean" },
        primaryKey: { type: "boolean" },
        data: {
            oneOf: [
                intDataSchema,
                floatDataSchema,
                strDataSchema,
                nanoidDataSchema,
                timestampDataSchema,
                jsonDataSchema,
                boolDataSchema,
                enumDataSchema,
                refDataSchema
            ]
        }
    },
    required: ["name", "slug", "data"],
    additionalProperties: false
}

export const tableDefinitionMetaSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        slug: { type: "string", pattern: identifierPattern },
        name: { type: "string", minLength: 1 },
        description: { type: "string" },
        scope: { type: "string", pattern: identifierPattern },
        meta: { type: "object" },
        columns: {
            type: "array",
            items: columnSchema,
            minItems: 1
        }
    },
    required: ["slug", "name", "columns"],
    additionalProperties: false
}
