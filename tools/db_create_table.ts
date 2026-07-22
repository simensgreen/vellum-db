import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { createTable } from "../src/core/table-ddl.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Table name ([a-z][a-z0-9_]*)",
    },
    schema: {
      type: "object",
      description:
        'JSON Schema object for row shape (type:"object", properties, optional required)',
    },
    scope: {
      type: ["string", "null"],
      description:
        "Optional scope label ([a-z][a-z0-9_]*). Use with db_list_tables scope filter.",
    },
  },
  required: ["name", "schema"],
} as const;

export default {
  description:
    "Create a structured table from a JSON Schema. Prefer this over raw SQL. An id TEXT PRIMARY KEY (nanoid) is added automatically. Procedure: skill_load { skill: \"vellum-db-meta\" }.",
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      createTable({
        name: String(validated.name),
        schema: validated.schema,
        scope: validated.scope as string | null | undefined,
      }),
    );
  },
};
