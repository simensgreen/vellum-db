import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import {
  getSavedQuery,
  substituteParams,
  type SavedQueryKind,
} from "../src/saved-queries.ts";
import type {
  AggregateDefinition,
  QueryDefinition,
} from "../src/query-compile.ts";
import { executeQueryDefinition } from "./db_query.ts";
import { executeAggregateDefinition } from "./db_aggregate.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    params: {
      type: "object",
      description: 'Values for "$param" placeholders in the saved definition',
    },
  },
  required: ["name"],
} as const;

export default {
  description:
    "Run a previously saved named query or aggregate. Pass params to bind $placeholders. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const saved = getSavedQuery(String(validated.name));
      if (!saved) {
        throw new Error(`Saved query "${validated.name}" does not exist`);
      }
      const params =
        validated.params !== null &&
        typeof validated.params === "object" &&
        !Array.isArray(validated.params)
          ? (validated.params as Record<string, unknown>)
          : {};
      const definition = substituteParams(
        JSON.parse(saved.definition_json),
        params,
      );
      const kind = saved.kind as SavedQueryKind;
      if (kind === "query") {
        return {
          name: saved.name,
          kind,
          result: executeQueryDefinition(definition as QueryDefinition),
        };
      }
      return {
        name: saved.name,
        kind,
        result: executeAggregateDefinition(definition as AggregateDefinition),
      };
    });
  },
};
