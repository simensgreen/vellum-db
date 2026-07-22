import { getConfig, getDatabase } from "../db.ts";
import { asBindings } from "../bindings.ts";
import { guardRawSql } from "../sql-guard.ts";
import { invalidationTagsForRawSqlMutation } from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";

export function executeRawSql(sql: string) {
  const guarded = guardRawSql(String(sql));
  const database = getDatabase();
  if (guarded.isSelect) {
    const rows = database.query(guarded.sql).all();
    const maxRows = getConfig().maxRowsPerQuery;
    const clipped = rows.slice(0, maxRows);
    return {
      kind: "select" as const,
      count: clipped.length,
      truncated: rows.length > maxRows,
      rows: clipped,
    };
  }
  const result = database.query(guarded.sql).run(...asBindings([]));
  notifyInvalidation(invalidationTagsForRawSqlMutation());
  return {
    kind: "exec" as const,
    changes: result.changes,
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}
