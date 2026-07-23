import type { JsonFilter } from "@truto/sqlite-builder"
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api"
import { buildQueryDefinition, executeQueryDefinition } from "../src/core/query.ts"
import type { OrderSpec, RefJoinSpec } from "../src/core/query-compile.ts"
import { runTool } from "../src/tool-result.ts"

const refJoinItemSchema = {
    type: "object",
    properties: {
        ref: {
            type: "string",
            description: "Ref column slug on the source table"
        },
        source: {
            type: "string",
            description:
                "Source table slug (default: base table for first join, otherwise a previously joined table)"
        },
        type: {
            type: "string",
            enum: ["left", "inner", "right"],
            description: "Join type (default: left)"
        },
        select: {
            type: "object",
            description: "Joined table column slug -> output alias",
            additionalProperties: { type: "string" }
        }
    },
    required: ["ref", "select"]
} as const

const inputSchema = {
    type: "object",
    properties: {
        table: { type: "string", description: "Source table slug" },
        filter: {
            type: "object",
            description: "JSON filter (eq as plain value; gt/gte/lt/lte/ne/in/like/and/or/...)"
        },
        order: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    column: { type: "string" },
                    direction: { type: "string", enum: ["asc", "desc"] }
                },
                required: ["column"]
            }
        },
        limit: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 },
        columns: {
            type: "array",
            items: { type: "string" },
            description: "Column slugs to return (default: all columns)"
        },
        joins: {
            type: "array",
            description: "Ref joins to related tables (left/inner/right)",
            items: refJoinItemSchema
        }
    },
    required: ["table"]
} as const

export { executeQueryDefinition }

export default {
    description:
        'Query rows with a JSON filter (not SQL). Supports joins, limit/offset pagination (has_more). Prefer db_run_view for repeats. Procedure: skill_load { skill: "vellum-db" }.',
    defaultRiskLevel: "low" as const,
    category: "data",
    input_schema: inputSchema,
    async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
        return runTool(input, inputSchema, (validated) =>
            executeQueryDefinition(
                buildQueryDefinition({
                    table: String(validated.table),
                    filter: validated.filter as JsonFilter | undefined,
                    order: validated.order as OrderSpec[] | undefined,
                    limit: validated.limit as number | undefined,
                    offset: validated.offset as number | undefined,
                    columns: validated.columns as string[] | undefined,
                    joins: validated.joins as RefJoinSpec[] | undefined
                })
            )
        )
    }
}
