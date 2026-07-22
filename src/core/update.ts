import { compileFilter, type JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../db.ts";
import { asBindings } from "../bindings.ts";
import {
  encodeCellValue,
  getTableColumns,
  quoteIdentExport,
  requireTable,
} from "./catalog.ts";
import { validateRowAgainstSchema } from "../schema-validate.ts";
import { invalidationTagsForRowMutation } from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";

export function updateRows(input: {
  table: string;
  filter: JsonFilter;
  patch: Record<string, unknown>;
}) {
  const table = requireTable(input.table);
  const filter = input.filter;
  if (!filter || Object.keys(filter).length === 0) {
    throw new Error("filter must be a non-empty object");
  }
  const patch = input.patch;
  const columns = getTableColumns(table);
  const columnByName = new Map(columns.map((column) => [column.name, column]));
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

  if (changes > 0) {
    notifyInvalidation(invalidationTagsForRowMutation(table.name));
  }

  return { table: table.name, matched: matched.length, changes };
}
