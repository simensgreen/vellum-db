import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { listSavedQueriesView } from "../src/core/saved-queries-api.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["query", "aggregate"],
      description: "Filter by saved query kind",
    },
    name_prefix: {
      type: "string",
      description: "Return saved queries whose name starts with this prefix",
    },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
  },
} as const;

export default {
  description:
    "List saved named queries with optional kind/name_prefix filters and limit/offset pagination. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      listSavedQueriesView({
        kind: validated.kind as "query" | "aggregate" | undefined,
        name_prefix: validated.name_prefix as string | undefined,
        limit: validated.limit as number | undefined,
        offset: validated.offset as number | undefined,
      }),
    );
  },
};
