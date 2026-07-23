import type { JsonFilter } from "@truto/sqlite-builder"
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api"
import { deleteRows } from "../src/core/delete.ts"
import { runTool } from "../src/tool-result.ts"

const inputSchema = {
    type: "object",
    properties: {
        table: { type: "string", description: "Target table slug" },
        filter: {
            type: "object",
            description:
                "JSON filter selecting rows to delete (required, non-empty; keys = column slugs)"
        }
    },
    required: ["table", "filter"]
} as const

export default {
    description:
        'Delete rows matching a JSON filter. Filter must be non-empty to avoid wiping a whole table by accident. Procedure: skill_load { skill: "vellum-db" }.',
    defaultRiskLevel: "high" as const,
    category: "data",
    input_schema: inputSchema,
    async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
        return runTool(input, inputSchema, (validated) =>
            deleteRows({
                table: String(validated.table),
                filter: validated.filter as JsonFilter
            })
        )
    }
}
