import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { listTablesView } from "../src/core/list-tables.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    scope: {
      type: ["string", "null"],
      description:
        "Exact scope filter ([a-z][a-z0-9_]*). null = only unscoped tables. Omit = all scopes.",
    },
    name_prefix: {
      type: "string",
      description: "Return tables whose name starts with this prefix",
    },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
  },
} as const;

export default {
  description:
    "List structured tables with optional scope/name_prefix filters and limit/offset pagination. Each entry includes name, scope, TableDefinition, and column slugs. Procedures: skill_load { skill: \"vellum-db\" } or { skill: \"vellum-db-meta\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      listTablesView({
        scope: validated.scope as string | null | undefined,
        name_prefix: validated.name_prefix as string | undefined,
        limit: validated.limit as number | undefined,
        offset: validated.offset as number | undefined,
      }),
    );
  },
};
