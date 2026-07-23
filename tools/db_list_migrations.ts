import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api"
import { listMigrationsView } from "../src/core/migrate.ts"
import { runTool } from "../src/tool-result.ts"

const inputSchema = {
    type: "object",
    properties: {
        limit: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 }
    }
} as const

export default {
    description:
        'List applied schema migrations with limit/offset pagination. Procedure: skill_load { skill: "vellum-db-meta" }.',
    defaultRiskLevel: "low" as const,
    category: "data",
    input_schema: inputSchema,
    async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
        return runTool(input, inputSchema, (validated) =>
            listMigrationsView({
                limit: validated.limit as number | undefined,
                offset: validated.offset as number | undefined
            })
        )
    }
}
