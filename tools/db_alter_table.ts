import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { alterUserTable, getTableColumns } from "../src/catalog.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string", description: "Existing table name" },
    add: {
      type: "array",
      description: "Columns to add",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          schema: {
            type: "object",
            description: "JSON Schema for the new column type",
          },
        },
        required: ["name", "schema"],
      },
    },
    drop: {
      type: "array",
      description: "Column names to drop (rebuilds table)",
      items: { type: "string" },
    },
    scope: {
      type: ["string", "null"],
      description:
        "Set or clear table scope ([a-z][a-z0-9_]*). null clears. Omit to leave unchanged.",
    },
  },
  required: ["table"],
} as const;

export default {
  description:
    "Alter a table: add/drop columns and/or set scope. Updates the stored JSON Schema. Cannot rename columns or change types. Procedure: skill_load { skill: \"vellum-db-meta\" }.",
  defaultRiskLevel: "high" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const table = alterUserTable({
        table: String(validated.table),
        add: validated.add as
          | Array<{ name: string; schema: unknown }>
          | undefined,
        drop: validated.drop as string[] | undefined,
        ...(Object.prototype.hasOwnProperty.call(validated, "scope")
          ? { scope: validated.scope as string | null }
          : {}),
      });
      return {
        name: table.name,
        scope: table.scope,
        schema: JSON.parse(table.schema_json),
        columns: getTableColumns(table).map((column) => column.name),
        updated_at: table.updated_at,
      };
    });
  },
};
