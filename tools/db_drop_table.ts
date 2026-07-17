import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { dropUserTable } from "../src/catalog.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: {
      type: "string",
      description: "Registered table name to drop",
    },
  },
  required: ["table"],
  additionalProperties: false,
} as const;

export default {
  description:
    "Drop a structured table and remove its catalog entry. Disabled unless config.allowDropTable is true. Procedure: skill_load { skill: \"vellum-db-meta\" }.",
  defaultRiskLevel: "high" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      return dropUserTable(String(validated.table));
    });
  },
};
