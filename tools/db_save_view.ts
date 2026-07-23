import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { saveViewApi, type ViewKind } from "../src/core/views-api.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    slug: {
      type: "string",
      description: "View slug ([a-z][a-z0-9_]*)",
    },
    name: {
      type: "string",
      description: "Human-readable view name",
    },
    kind: {
      type: "string",
      enum: ["query", "aggregate"],
    },
    definition: {
      type: "object",
      description:
        "Same shape as db_query or db_aggregate input. Use \"$param\" string values for runtime params.",
    },
    description: {
      type: "string",
      description: "Human/agent-readable summary of what this view does",
    },
    scope: {
      type: "string",
      description: "Optional scope ([a-z][a-z0-9_]*) for grouping views",
    },
  },
  required: ["slug", "name", "kind", "definition"],
} as const;

export default {
  description:
    "Save a named query or aggregate view for later db_run_view. Upserts by slug. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      saveViewApi({
        slug: String(validated.slug),
        name: String(validated.name),
        kind: validated.kind as ViewKind,
        definition: validated.definition,
        description:
          typeof validated.description === "string"
            ? validated.description
            : undefined,
        scope:
          typeof validated.scope === "string" ? validated.scope : undefined,
      }),
    );
  },
};
