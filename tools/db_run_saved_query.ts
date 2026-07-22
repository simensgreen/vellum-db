import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { runSavedQueryView } from "../src/core/saved-queries-api.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    params: {
      type: "object",
      description: 'Values for "$param" placeholders in the saved definition',
    },
  },
  required: ["name"],
} as const;

export default {
  description:
    "Run a previously saved named query or aggregate. Pass params to bind $placeholders. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const params =
        validated.params !== null &&
        typeof validated.params === "object" &&
        !Array.isArray(validated.params)
          ? (validated.params as Record<string, unknown>)
          : undefined;
      return runSavedQueryView({
        name: String(validated.name),
        params,
      });
    });
  },
};
