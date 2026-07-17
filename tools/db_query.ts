import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import type { JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../src/db.ts";
import { asBindings } from "../src/bindings.ts";
import {
  decodeRow,
  getTableColumns,
  requireTable,
} from "../src/catalog.ts";
import { pageFromRows } from "../src/pagination.ts";
import {
  compileSelectQuery,
  type OrderSpec,
  type QueryDefinition,
} from "../src/query-compile.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    filter: {
      type: "object",
      description:
        "JSON filter (eq as plain value; gt/gte/lt/lte/ne/in/like/and/or/...)",
    },
    order: {
      type: "array",
      items: {
        type: "object",
        properties: {
          column: { type: "string" },
          direction: { type: "string", enum: ["asc", "desc"] },
        },
        required: ["column"],
      },
    },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    columns: {
      type: "array",
      items: { type: "string" },
      description: "Columns to return (default: all including id)",
    },
  },
  required: ["table"],
} as const;

export function executeQueryDefinition(definition: QueryDefinition) {
  const table = requireTable(definition.table);
  const columns = getTableColumns(table);
  const compiled = compileSelectQuery(definition);
  const fetched = getDatabase()
    .query(compiled.text)
    .all(...asBindings(compiled.values)) as Record<string, unknown>[];
  const page = pageFromRows(fetched, compiled.limit, compiled.offset);
  return {
    table: table.name,
    count: page.count,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
    rows: page.items.map((row) => decodeRow(row, columns)),
  };
}

export default {
  description:
    "Query rows with a JSON filter (not SQL). Supports limit/offset pagination (has_more). Prefer db_save_query for repeats. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "low" as const,
  category: "data",
  input_schema: inputSchema,
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runTool(input, inputSchema, (validated) => {
      const definition: QueryDefinition = {
        table: String(validated.table),
        filter: validated.filter as JsonFilter | undefined,
        order: validated.order as OrderSpec[] | undefined,
        limit: validated.limit as number | undefined,
        offset: validated.offset as number | undefined,
        columns: validated.columns as string[] | undefined,
      };
      return executeQueryDefinition(definition);
    });
  },
};
