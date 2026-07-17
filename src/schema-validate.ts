import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
});

const validatorCache = new Map<string, ValidateFunction>();

export type JsonSchemaObject = {
  type?: string | string[];
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean | Record<string, unknown>;
  [key: string]: unknown;
};

const tableSchemaMeta: JsonSchemaObject = {
  type: "object",
  properties: {
    type: { const: "object" },
    properties: {
      type: "object",
      minProperties: 1,
      additionalProperties: { type: "object" },
    },
    required: {
      type: "array",
      items: { type: "string" },
    },
    additionalProperties: {},
  },
  required: ["type", "properties"],
  additionalProperties: true,
};

const validateTableSchemaFn = ajv.compile(tableSchemaMeta);

export function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "validation failed";
  }
  return errors
    .map((error) => {
      const path = error.instancePath || "/";
      return `${path}: ${error.message ?? "invalid"}`;
    })
    .join("; ");
}

export function assertTableJsonSchema(schema: unknown): JsonSchemaObject {
  if (!validateTableSchemaFn(schema)) {
    throw new Error(
      `Invalid table JSON Schema: ${formatAjvErrors(validateTableSchemaFn.errors)}`,
    );
  }
  const objectSchema = schema as JsonSchemaObject;
  if (objectSchema.type !== "object") {
    throw new Error('Table schema type must be "object"');
  }
  const properties = objectSchema.properties;
  if (!properties || typeof properties !== "object") {
    throw new Error("Table schema must include properties");
  }
  for (const propertyName of Object.keys(properties)) {
    if (propertyName === "id") {
      throw new Error('Column name "id" is reserved (nanoid primary key)');
    }
  }
  return objectSchema;
}

export function validateRowAgainstSchema(
  tableName: string,
  schemaJson: string,
  row: unknown,
): void {
  let validator = validatorCache.get(schemaJson);
  if (!validator) {
    const schema = JSON.parse(schemaJson) as JsonSchemaObject;
    validator = ajv.compile(schema);
    validatorCache.set(schemaJson, validator);
  }
  if (!validator(row)) {
    throw new Error(
      `Row validation failed for table "${tableName}": ${formatAjvErrors(validator.errors)}`,
    );
  }
}

export function invalidateSchemaCache(schemaJson?: string): void {
  if (schemaJson) {
    validatorCache.delete(schemaJson);
    return;
  }
  validatorCache.clear();
}

export function validateAgainstSchema(
  schema: object,
  value: unknown,
  label: string,
): void {
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    throw new Error(
      `${label} validation failed: ${formatAjvErrors(validator.errors)}`,
    );
  }
}

export { ajv };
