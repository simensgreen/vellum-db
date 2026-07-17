import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import {
  saveQuery,
  type SavedQueryKind,
} from "../src/saved-queries.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Saved query name ([a-z][a-z0-9_]*)",
    },
    kind: {
      type: "string",
      enum: ["query", "aggregate"],
    },
    definition: {
      type: "object",
      description:
        "Same shape as db_query or db_aggregate input. Use \"$param\" string values for runtime params.",
    },
    description: {
      type: "string",
      description: "Human/agent-readable summary of what this query does",
    },
  },
  required: ["name", "kind", "definition"],
  additionalProperties: false,
} as const;

export default {
  description:
    "Save a named query or aggregate definition for later db_run_saved_query. Upserts by name. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const saved = saveQuery({
        name: String(validated.name),
        kind: validated.kind as SavedQueryKind,
        definition: validated.definition,
        description:
          typeof validated.description === "string"
            ? validated.description
            : undefined,
      });
      return {
        name: saved.name,
        kind: saved.kind,
        description: saved.description,
        definition: JSON.parse(saved.definition_json),
        updated_at: saved.updated_at,
      };
    });
  },
};
