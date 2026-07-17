import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { listSavedQueries } from "../src/saved-queries.ts";
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
    return runTool(input, inputSchema, (validated) => {
      const page = listSavedQueries({
        kind: validated.kind as "query" | "aggregate" | undefined,
        name_prefix: validated.name_prefix as string | undefined,
        limit: validated.limit as number | undefined,
        offset: validated.offset as number | undefined,
      });
      return {
        queries: page.queries.map((row) => ({
          name: row.name,
          kind: row.kind,
          description: row.description,
          definition: JSON.parse(row.definition_json),
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
        count: page.count,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more,
      };
    });
  },
};
