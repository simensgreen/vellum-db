import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import {
  loadTableFromFile,
  type IoMode,
} from "../src/table-io.ts";
import {
  onConflictInputSchema,
  type OnConflict,
} from "../src/insert.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string", description: "Target table name" },
    path: {
      type: "string",
      description:
        "File path. Relative paths resolve under the Vellum workspace; must stay inside the workspace.",
    },
    mode: {
      type: "string",
      enum: ["csv", "json", "jsonl", "xls"],
      description:
        "File format. json = array of objects; jsonl = one object per line; csv = header row; xls = Excel workbook (.xlsx).",
    },
    on_conflict: onConflictInputSchema,
  },
  required: ["table", "path", "mode"],
} as const;

export default {
  description:
    'Load rows from a file into a table (csv | json | jsonl | xls). Optional on_conflict: abort | ignore | replace (by id). Procedure: skill_load { skill: "vellum-db" }.',
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      loadTableFromFile({
        table: String(validated.table),
        path: String(validated.path),
        mode: validated.mode as IoMode,
        on_conflict: validated.on_conflict as OnConflict | undefined,
      }),
    );
  },
};
