import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import type { TableDefinition } from "../src/core/table/types.ts";
import { createTable } from "../src/core/table-ddl.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    definition: {
      type: "object",
      description:
        "TableDefinition DSL (slug, name, columns with primaryKey and data types). slug becomes the table name.",
    },
    scope: {
      type: ["string", "null"],
      description:
        "Optional scope label ([a-z][a-z0-9_]*). Use with db_list_tables scope filter.",
    },
  },
  required: ["definition"],
} as const;

export default {
  description:
    "Create a structured table from a TableDefinition DSL object. Prefer this over raw SQL. Procedure: skill_load { skill: \"vellum-db-meta\" }.",
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      createTable({
        definition: validated.definition as TableDefinition,
        scope: validated.scope as string | null | undefined,
      }),
    );
  },
};
