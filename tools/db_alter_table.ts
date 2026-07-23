import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import type { TableDefinition } from "../src/core/table/types.ts";
import { alterTable } from "../src/core/table-ddl.ts";
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
          name: { type: "string", description: "Display name" },
          slug: { type: "string", description: "Column slug" },
          column: {
            type: "object",
            description: "Full ColumnDefinition object (name, slug, data, …)",
          },
        },
        required: ["name", "slug", "column"],
      },
    },
    drop: {
      type: "array",
      description: "Column slugs to drop (rebuilds table)",
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
    "Alter a table: add/drop columns and/or set scope. Updates the stored TableDefinition. Cannot rename columns or change types. Procedure: skill_load { skill: \"vellum-db-meta\" }.",
  defaultRiskLevel: "high" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const alterInput: {
        table: string;
        add?: Array<{
          name: string;
          slug: string;
          column: TableDefinition["columns"][number];
        }>;
        drop?: string[];
        scope?: string | null;
      } = {
        table: String(validated.table),
        add: validated.add as
          | Array<{
              name: string;
              slug: string;
              column: TableDefinition["columns"][number];
            }>
          | undefined,
        drop: validated.drop as string[] | undefined,
      };
      if (Object.prototype.hasOwnProperty.call(validated, "scope")) {
        alterInput.scope = validated.scope as string | null;
      }
      return alterTable(alterInput);
    });
  },
};
