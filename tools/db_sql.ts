import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { executeRawSql } from "../src/core/sql.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    sql: {
      type: "string",
      description:
        "Single SQL statement (no semicolons). select-only mode: SELECT/WITH only. on mode: any statement.",
    },
  },
  required: ["sql"],
} as const;

export default {
  description:
    "Escape hatch: run raw SQL. Mode from config.rawSqlMode (select-only | on | off). Prefer JSON tools. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "high" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      executeRawSql(String(validated.sql)),
    );
  },
};
