import { compileFilter, type JsonFilter } from "@truto/sqlite-builder";
import { getDatabase } from "../db.ts";
import { asBindings } from "../bindings.ts";
import { quoteIdentExport, requireTable } from "./catalog.ts";
import { invalidationTagsForRowMutation } from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";
import { isUserTableName, recordStatsDelta } from "./stats-store.ts";
import { resolveRowIdFilter } from "./row-id-filter.ts";

export function deleteRows(input: {
  table: string;
  filter: JsonFilter;
  sideEffects?: boolean;
}) {
  const sideEffects = input.sideEffects ?? true;
  const table = requireTable(input.table);
  const filter = resolveRowIdFilter(input.table, input.filter);
  if (!filter || Object.keys(filter).length === 0) {
    throw new Error("filter must be a non-empty object");
  }
  const filterResult = compileFilter(filter);
  const sqlText = `DELETE FROM ${quoteIdentExport(table.name)} WHERE ${filterResult.text}`;
  const result = getDatabase()
    .query(sqlText)
    .run(...asBindings(filterResult.values));

  if (sideEffects && result.changes > 0) {
    notifyInvalidation(invalidationTagsForRowMutation(table.name));
    if (isUserTableName(table.name)) {
      recordStatsDelta({ deletions: result.changes });
    }
  }

  return { table: table.name, changes: result.changes };
}
