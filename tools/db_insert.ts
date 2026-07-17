import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import {
  insertTableRow,
  onConflictInputSchema,
  parseOnConflict,
} from "../src/insert.ts";
import { requireTable } from "../src/catalog.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    row: {
      type: "object",
      description:
        "Row object matching the table JSON Schema. Optional nanoid string id for conflict handling; generated if omitted.",
    },
    on_conflict: onConflictInputSchema,
  },
  required: ["table", "row"],
  additionalProperties: false,
} as const;

export default {
  description:
    'Insert a row into a structured table. Optional on_conflict: abort (default) | ignore | replace (by primary key id). Procedure: skill_load { skill: "vellum-db" }.',
  defaultRiskLevel: "medium" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const table = requireTable(String(validated.table));
      const onConflict = parseOnConflict(validated.on_conflict);
      const result = insertTableRow(
        table,
        validated.row as Record<string, unknown>,
        onConflict,
      );
      return {
        table: table.name,
        id: result.id,
        changes: result.changes,
        outcome: result.outcome,
        on_conflict: onConflict,
      };
    });
  },
};
