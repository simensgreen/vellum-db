import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { compileFilter, type JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../src/db.ts";
import { asBindings } from "../src/bindings.ts";
import { quoteIdentExport, requireTable } from "../src/catalog.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    filter: {
      type: "object",
      description: "JSON filter selecting rows to delete (required, non-empty)",
    },
  },
  required: ["table", "filter"],
} as const;

export default {
  description:
    "Delete rows matching a JSON filter. Filter must be non-empty to avoid wiping a whole table by accident. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "high" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const table = requireTable(String(validated.table));
      const filter = validated.filter as JsonFilter;
      if (!filter || Object.keys(filter).length === 0) {
        throw new Error("filter must be a non-empty object");
      }
      const filterResult = compileFilter(filter);
      const sqlText = `DELETE FROM ${quoteIdentExport(table.name)} WHERE ${filterResult.text}`;
      const result = getDatabase()
        .query(sqlText)
        .run(...asBindings(filterResult.values));
      return { table: table.name, changes: result.changes };
    });
  },
};
