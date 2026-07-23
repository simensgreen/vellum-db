import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api"
import { runView } from "../src/core/views-api.ts"
import { runTool } from "../src/tool-result.ts"

const inputSchema = {
    type: "object",
    properties: {
        slug: {
            type: "string",
            description: "View slug"
        },
        params: {
            type: "object",
            description:
                'Map of placeholder name to value for every "$param" in the view definition'
        }
    },
    required: ["slug"]
} as const

export default {
    description:
        'Execute a previously saved view. Bind every "$placeholder" via params. Procedure: skill_load { skill: "vellum-db" }.',
    defaultRiskLevel: "low" as const,
    category: "data",
    input_schema: inputSchema,
    async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
        return runTool(input, inputSchema, (validated) => {
            const params =
                validated.params !== null &&
                typeof validated.params === "object" &&
                !Array.isArray(validated.params)
                    ? (validated.params as Record<string, unknown>)
                    : undefined
            return runView({
                slug: String(validated.slug),
                params
            })
        })
    }
}
