import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { deleteSavedQueryByName } from "../src/core/saved-queries-api.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
  },
  required: ["name"],
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
    return runTool(input, inputSchema, (validated) =>
      deleteSavedQueryByName(String(validated.name)),
    );
  },
};
