import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { deleteViewBySlug } from "../src/core/views-api.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    slug: {
      type: "string",
      description: "View slug to delete",
    },
  },
  required: ["slug"],
} as const;

export default {
  description:
    "Delete a named view by slug. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "high" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      deleteViewBySlug(String(validated.slug)),
    );
  },
};
