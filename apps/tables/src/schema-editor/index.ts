export type VisualColumnType = "string" | "integer" | "number" | "boolean";

export type VisualColumn = {
  name: string;
  type: VisualColumnType;
  required: boolean;
};

const VISUAL_TYPES: ReadonlySet<string> = new Set([
  "string",
  "integer",
  "number",
  "boolean",
]);

export function emptyVisualColumn(): VisualColumn {
  return { name: "", type: "string", required: false };
}

export function visualToJsonSchema(
  columns: VisualColumn[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const column of columns) {
    const name = column.name.trim();
    if (!name) {
      continue;
    }
    properties[name] = { type: column.type };
    if (column.required) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function jsonSchemaToVisual(schema: unknown): VisualColumn[] {
  if (schema === null || typeof schema !== "object") {
    return [emptyVisualColumn()];
  }

  const root = schema as Record<string, unknown>;
  if (root.type !== "object") {
    return [emptyVisualColumn()];
  }

  const properties =
    root.properties !== null && typeof root.properties === "object"
      ? (root.properties as Record<string, unknown>)
      : {};
  const requiredSet = new Set(
    Array.isArray(root.required)
      ? root.required.filter((entry): entry is string => typeof entry === "string")
      : [],
  );

  const columns = Object.entries(properties).map(([name, propertySchema]) => {
    const property =
      propertySchema !== null && typeof propertySchema === "object"
        ? (propertySchema as Record<string, unknown>)
        : {};
    const typeValue = property.type;
    const typeName = Array.isArray(typeValue) ? typeValue[0] : typeValue;
    const visualType =
      typeof typeName === "string" && VISUAL_TYPES.has(typeName)
        ? (typeName as VisualColumnType)
        : "string";

    return {
      name,
      type: visualType,
      required: requiredSet.has(name),
    };
  });

  return columns.length > 0 ? columns : [emptyVisualColumn()];
}

export function parseJsonSchemaText(text: string): {
  schema: Record<string, unknown> | null;
  error: string | null;
} {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { schema: null, error: "Schema must be a JSON object" };
    }
    return { schema: parsed as Record<string, unknown>, error: null };
  } catch {
    return { schema: null, error: "Invalid JSON" };
  }
}

export const TABLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export function validateTableName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Table name is required";
  }
  if (!TABLE_NAME_PATTERN.test(trimmed)) {
    return "Name must match [a-z][a-z0-9_]*";
  }
  return null;
}

export const SCOPE_PATTERN = /^[a-z][a-z0-9_]*$/;

export function validateScope(scope: string): string | null {
  const trimmed = scope.trim();
  if (!trimmed) {
    return null;
  }
  if (!SCOPE_PATTERN.test(trimmed)) {
    return "Scope must match [a-z][a-z0-9_]*";
  }
  return null;
}
