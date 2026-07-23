import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { dumpTableToFile, type IoMode } from "../src/core/table-io.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string", description: "Source table name" },
    path: {
      type: "string",
      description:
        "Output file path. Relative paths resolve under the Vellum workspace; must stay inside the workspace.",
    },
    mode: {
      type: "string",
      enum: ["csv", "json", "jsonl", "xlsx"],
      description:
        "File format. json = array of objects; jsonl = one object per line; csv = header row; xlsx = Excel workbook.",
    },
  },
  required: ["table", "path", "mode"],
} as const;

export default {
  description:
    "Dump all rows from a table to a file (csv | json | jsonl | xlsx). Includes primary key columns. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      dumpTableToFile({
        table: String(validated.table),
        path: String(validated.path),
        mode: validated.mode as IoMode,
      }),
    );
  },
};
