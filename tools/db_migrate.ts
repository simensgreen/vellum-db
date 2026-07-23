import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { applyMigration } from "../src/core/migrate.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    path: {
      type: "string",
      description:
        "Workspace-relative path to a flat migration JSON file (e.g. migrate.up.json or migrate.down.json).",
    },
    hash: {
      type: "string",
      description: "Applied migration hash (returns already_applied if recorded).",
    },
    id: {
      type: "integer",
      minimum: 1,
      description: "Applied migration id (returns already_applied if recorded).",
    },
  },
} as const;

export default {
  description:
    'Apply a flat schema migration file (create/alter/drop/seed/views). Procedure: skill_load { skill: "vellum-db-meta" }.',
  defaultRiskLevel: "high" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      applyMigration({
        path: validated.path as string | undefined,
        hash: validated.hash as string | undefined,
        id: validated.id as number | undefined,
      }),
    );
  },
};
