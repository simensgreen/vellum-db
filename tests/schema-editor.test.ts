import { describe, expect, test } from "bun:test";
import {
  emptyVisualColumn,
  jsonSchemaToVisual,
  parseJsonSchemaText,
  validateScope,
  validateTableName,
  visualToJsonSchema,
} from "../apps/tables/src/schema-editor/index.ts";

describe("schema-editor", () => {
  test("visualToJsonSchema builds object schema with required", () => {
    const schema = visualToJsonSchema([
      { name: "title", type: "string", required: true },
      { name: "done", type: "boolean", required: false },
    ]);
    expect(schema).toEqual({
      type: "object",
      properties: {
        title: { type: "string" },
        done: { type: "boolean" },
      },
      required: ["title"],
    });
  });

  test("jsonSchemaToVisual round-trips simple schemas", () => {
    const schema = visualToJsonSchema([
      { name: "amount", type: "number", required: true },
      { name: "note", type: "string", required: false },
    ]);
    const columns = jsonSchemaToVisual(schema);
    expect(columns).toEqual([
      { name: "amount", type: "number", required: true },
      { name: "note", type: "string", required: false },
    ]);
  });

  test("jsonSchemaToVisual returns empty row for invalid schema", () => {
    expect(jsonSchemaToVisual(null)).toEqual([emptyVisualColumn()]);
    expect(jsonSchemaToVisual({ type: "array" })).toEqual([emptyVisualColumn()]);
  });

  test("parseJsonSchemaText validates JSON object", () => {
    expect(parseJsonSchemaText('{"type":"object"}').error).toBeNull();
    expect(parseJsonSchemaText("[]").error).toBe("Schema must be a JSON object");
    expect(parseJsonSchemaText("{").error).toBe("Invalid JSON");
  });

  test("validateTableName enforces identifier pattern", () => {
    expect(validateTableName("tasks")).toBeNull();
    expect(validateTableName("Tasks")).toContain("match");
    expect(validateTableName("")).toContain("required");
  });

  test("validateScope allows empty or valid scope", () => {
    expect(validateScope("")).toBeNull();
    expect(validateScope("finance")).toBeNull();
    expect(validateScope("Finance")).toContain("match");
  });
});
