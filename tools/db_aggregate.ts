import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import type { JsonFilter } from "@truto/sqlite-builder";
import {
  buildAggregateDefinition,
  executeAggregateDefinition,
  type AggregateMetric,
} from "../src/core/aggregate.ts";
import type { OrderSpec, RefJoinSpec } from "../src/core/query-compile.ts";
import { runTool } from "../src/tool-result.ts";

const refJoinItemSchema = {
  type: "object",
  properties: {
    ref: { type: "string" },
    source: { type: "string" },
    type: { type: "string", enum: ["left", "inner", "right"] },
    select: {
      type: "object",
      additionalProperties: { type: "string" },
    },
  },
  required: ["ref", "select"],
} as const;

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
    joins: {
      type: "array",
      items: refJoinItemSchema,
    },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
  },
  required: ["table", "metrics"],
} as const;

export { executeAggregateDefinition };

export default {
  description:
    "Prefer db_run_view for repeats. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      executeAggregateDefinition(
        buildAggregateDefinition({
          table: String(validated.table),
          metrics: validated.metrics as AggregateMetric[],
          group_by: validated.group_by as string[] | undefined,
          filter: validated.filter as JsonFilter | undefined,
          having: validated.having as JsonFilter | undefined,
          order: validated.order as OrderSpec[] | undefined,
          joins: validated.joins as RefJoinSpec[] | undefined,
          limit: validated.limit as number | undefined,
          offset: validated.offset as number | undefined,
        }),
      ),
    );
  },
};
