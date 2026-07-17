import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { getConfig, getDatabase } from "../src/db.ts";
import { asBindings } from "../src/bindings.ts";
import { guardRawSql } from "../src/sql-guard.ts";
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
  additionalProperties: false,
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
    return runTool(input, inputSchema, (validated) => {
      const guarded = guardRawSql(String(validated.sql));
      const database = getDatabase();
      if (guarded.isSelect) {
        const rows = database.query(guarded.sql).all();
        const maxRows = getConfig().maxRowsPerQuery;
        const clipped = rows.slice(0, maxRows);
        return {
          kind: "select",
          count: clipped.length,
          truncated: rows.length > maxRows,
          rows: clipped,
        };
      }
      const result = database.query(guarded.sql).run(...asBindings([]));
      return {
        kind: "exec",
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    });
  },
};
