import type { JsonFilter } from "@truto/sqlite-builder"
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api"
import { updateRows } from "../src/core/update.ts"
import { runTool } from "../src/tool-result.ts"

const inputSchema = {
    type: "object",
    properties: {
        table: { type: "string" },
        filter: {
            type: "object",
            description:
                "JSON filter selecting rows to update (required, non-empty; keys = column slugs)"
        },
        patch: {
            type: "object",
            description:
                "Partial row fields to set (column slugs); merged with existing for validation",
            minProperties: 1
        }
    },
    required: ["table", "filter", "patch"]
} as const

export default {
    description:
        'Update rows matching a JSON filter. Patch fields are merged onto each matched row and validated against the table schema. Procedure: skill_load { skill: "vellum-db" }.',
    defaultRiskLevel: "medium" as const,
    category: "data",
    input_schema: inputSchema,
    async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
        return runTool(input, inputSchema, (validated) =>
            updateRows({
                table: String(validated.table),
                filter: validated.filter as JsonFilter,
                patch: validated.patch as Record<string, unknown>
            })
        )
    }
}
