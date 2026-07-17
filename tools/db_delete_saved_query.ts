import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { deleteSavedQuery } from "../src/saved-queries.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
  },
  required: ["name"],
  additionalProperties: false,
} as const;

export default {
  description:
    "Delete a saved named query by name. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      deleteSavedQuery(String(validated.name));
      return { deleted: String(validated.name) };
    });
  },
};
