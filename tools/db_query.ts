import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import type { JsonFilter } from "@truto/sqlite-builder";
import {
  buildQueryDefinition,
  executeQueryDefinition,
} from "../src/core/query.ts";
import type { OrderSpec } from "../src/core/query-compile.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    filter: {
      type: "object",
      description:
        "JSON filter (eq as plain value; gt/gte/lt/lte/ne/in/like/and/or/...)",
    },
    order: {
      type: "array",
      items: {
        type: "object",
        properties: {
          column: { type: "string" },
          direction: { type: "string", enum: ["asc", "desc"] },
        },
        required: ["column"],
      },
    },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    columns: {
      type: "array",
      items: { type: "string" },
      description: "Columns to return (default: all including id)",
    },
  },
  required: ["table"],
} as const;

export { executeQueryDefinition };

export default {
  description:
    "Query rows with a JSON filter (not SQL). Supports limit/offset pagination (has_more). Prefer db_save_query for repeats. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      executeQueryDefinition(
        buildQueryDefinition({
          table: String(validated.table),
          filter: validated.filter as JsonFilter | undefined,
          order: validated.order as OrderSpec[] | undefined,
          limit: validated.limit as number | undefined,
          offset: validated.offset as number | undefined,
          columns: validated.columns as string[] | undefined,
        }),
      ),
    );
  },
};
