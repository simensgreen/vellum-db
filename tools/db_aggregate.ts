import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import type { JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../src/db.ts";
import { asBindings } from "../src/bindings.ts";
import { pageFromRows } from "../src/pagination.ts";
import {
  compileAggregateQuery,
  type AggregateDefinition,
  type AggregateMetric,
} from "../src/query-compile.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    metrics: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          fn: {
            type: "string",
            enum: ["count", "sum", "avg", "min", "max"],
          },
          column: { type: "string" },
          as: { type: "string" },
        },
        required: ["fn", "as"],
      },
    },
    group_by: { type: "array", items: { type: "string" } },
    filter: { type: "object" },
    having: {
      type: "object",
      description: "JSON filter applied after GROUP BY (HAVING)",
    },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
  },
  required: ["table", "metrics"],
} as const;

export function executeAggregateDefinition(definition: AggregateDefinition) {
  const compiled = compileAggregateQuery(definition);
  const fetched = getDatabase()
    .query(compiled.text)
    .all(...asBindings(compiled.values));
  const page = pageFromRows(fetched, compiled.limit, compiled.offset);
  return {
    table: definition.table,
    count: page.count,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
    rows: page.items,
  };
}

export default {
  description:
    "Aggregate rows with JSON metrics (count/sum/avg/min/max), optional group_by/filter/having/limit/offset (has_more). Prefer db_save_query for repeats. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const definition: AggregateDefinition = {
        table: String(validated.table),
        metrics: validated.metrics as AggregateMetric[],
        group_by: validated.group_by as string[] | undefined,
        filter: validated.filter as JsonFilter | undefined,
        having: validated.having as JsonFilter | undefined,
        limit: validated.limit as number | undefined,
        offset: validated.offset as number | undefined,
      };
      return executeAggregateDefinition(definition);
    });
  },
};
