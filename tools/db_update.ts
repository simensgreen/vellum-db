import type {
  ToolContext,
  ToolExecutionResult,
} from "@vellumai/plugin-api";
import { compileFilter, type JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../src/db.ts";
import { asBindings } from "../src/bindings.ts";
import {
  encodeCellValue,
  getTableColumns,
  quoteIdentExport,
  requireTable,
} from "../src/catalog.ts";
import { validateRowAgainstSchema } from "../src/schema-validate.ts";
import { runTool } from "../src/tool-result.ts";

const inputSchema = {
  type: "object",
  properties: {
    table: { type: "string" },
    filter: {
      type: "object",
      description: "JSON filter selecting rows to update (required, non-empty)",
    },
    patch: {
      type: "object",
      description: "Partial row fields to set; merged with existing for validation",
      minProperties: 1,
    },
  },
  required: ["table", "filter", "patch"],
} as const;

export default {
  description:
    "Update rows matching a JSON filter. Patch fields are merged onto each matched row and validated against the table schema. Procedure: skill_load { skill: \"vellum-db\" }.",
  defaultRiskLevel: "medium" as const,
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
      const patch = validated.patch as Record<string, unknown>;
      const columns = getTableColumns(table);
      const columnByName = new Map(
        columns.map((column) => [column.name, column]),
      );
      for (const key of Object.keys(patch)) {
        if (!columnByName.has(key)) {
          throw new Error(`Unknown column "${key}" in patch`);
        }
      }

      const filterResult = compileFilter(filter);
      const selectSql = `SELECT * FROM ${quoteIdentExport(table.name)} WHERE ${filterResult.text}`;
      const matched = getDatabase()
        .query(selectSql)
        .all(...asBindings(filterResult.values)) as Record<string, unknown>[];

      let changes = 0;
      for (const existing of matched) {
        const merged: Record<string, unknown> = {};
        for (const column of columns) {
          const raw = existing[column.name];
          if (column.jsonStored && typeof raw === "string") {
            try {
              merged[column.name] = JSON.parse(raw);
            } catch {
              merged[column.name] = raw;
            }
          } else {
            merged[column.name] = raw;
          }
        }
        Object.assign(merged, patch);
        validateRowAgainstSchema(table.name, table.schema_json, merged);

        const setColumns = Object.keys(patch);
        const setSql = setColumns
          .map((name) => `${quoteIdentExport(name)} = ?`)
          .join(", ");
        const setValues = setColumns.map((name) =>
          encodeCellValue(patch[name], columnByName.get(name)!),
        );
        const updateSql = `UPDATE ${quoteIdentExport(table.name)} SET ${setSql} WHERE "id" = ?`;
        const result = getDatabase()
          .query(updateSql)
          .run(...asBindings([...setValues, existing.id]));
        changes += result.changes;
      }

      return { table: table.name, matched: matched.length, changes };
    });
  },
};
