import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api"
import { listViewsView } from "../src/core/views-api.ts"
import { runTool } from "../src/tool-result.ts"

const inputSchema = {
    type: "object",
    properties: {
        kind: {
            type: "string",
            enum: ["query", "aggregate"],
            description: "Filter by view kind"
        },
        scope: {
            type: ["string", "null"],
            description:
                "Exact scope filter ([a-z][a-z0-9_]*). null = only unscoped views. Omit = all scopes."
        },
        slug_prefix: {
            type: "string",
            description: "Return views whose slug starts with this prefix"
        },
        limit: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 }
    }
} as const

export default {
    description:
        'List named views with optional kind, scope, and slug_prefix filters. Procedure: skill_load { skill: "vellum-db" }.',
    defaultRiskLevel: "low" as const,
    category: "data",
    input_schema: inputSchema,
    async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
        return runTool(input, inputSchema, (validated) =>
            listViewsView({
                kind: validated.kind as "query" | "aggregate" | undefined,
                scope: validated.scope as string | null | undefined,
                slug_prefix:
                    typeof validated.slug_prefix === "string" ? validated.slug_prefix : undefined,
                limit: typeof validated.limit === "number" ? validated.limit : undefined,
                offset: typeof validated.offset === "number" ? validated.offset : undefined
            })
        )
    }
}
