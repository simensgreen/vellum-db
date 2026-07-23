import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { insertRow } from "../src/core/rows.ts";
import {
  onConflictInputSchema,
  parseOnConflict,
} from "../src/core/insert.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    row: {
      type: "object",
      description:
        "Row object matching the table row schema. Primary key columns optional when defaults apply (e.g. nanoid).",
    },
    on_conflict: onConflictInputSchema,
  },
  required: ["table", "row"],
} as const;

export default {
  description:
    'Insert a row into a structured table. Row keys are column slugs. Primary key columns optional when defaults apply (e.g. nanoid). Optional on_conflict: abort (default) | ignore | replace (by primary key). Procedure: skill_load { skill: "vellum-db" }.',
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) =>
      insertRow({
        table: String(validated.table),
        row: validated.row as Record<string, unknown>,
        on_conflict: parseOnConflict(validated.on_conflict),
      }),
    );
  },
};
