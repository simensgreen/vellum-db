import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { getTableColumns, listTables } from "../src/catalog.ts";
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
    "List structured tables with optional scope/name_prefix filters and limit/offset pagination. Procedures: skill_load { skill: \"vellum-db\" } or { skill: \"vellum-db-meta\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const page = listTables({
        scope: validated.scope as string | null | undefined,
        name_prefix: validated.name_prefix as string | undefined,
        limit: validated.limit as number | undefined,
        offset: validated.offset as number | undefined,
      });
      return {
        tables: page.tables.map((table) => ({
          name: table.name,
          scope: table.scope,
          schema: JSON.parse(table.schema_json),
          columns: getTableColumns(table),
          created_at: table.created_at,
          updated_at: table.updated_at,
        })),
        count: page.count,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more,
      };
    });
  },
};
