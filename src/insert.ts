import { nanoid } from "nanoid";
import { asBindings } from "./bindings.ts";
import {
  encodeCellValue,
  getTableColumns,
  quoteIdentExport,
  type TableRow,
} from "./catalog.ts";
import { getDatabase } from "./db.ts";
import { validateRowAgainstSchema } from "./schema-validate.ts";

export type OnConflict = "abort" | "ignore" | "replace";

export type InsertOutcome = "inserted" | "ignored" | "replaced";

/** URL-safe nanoid alphabet; generated ids use the default nanoid() length (21). */
const ROWID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const onConflictInputSchema = {
  type: "string",
  enum: ["abort", "ignore", "replace"],
  description:
    'Primary-key conflict policy for optional row id: "abort" (default) fails, "ignore" skips, "replace" overwrites. Without id, a new nanoid is generated.',
} as const;

export function createRowId(): string {
  return nanoid();
}

export function parseOnConflict(value: unknown): OnConflict {
  if (value === undefined) {
    return "abort";
  }
  if (value === "abort" || value === "ignore" || value === "replace") {
    return value;
  }
  throw new Error('on_conflict must be "abort", "ignore", or "replace"');
}

export function parseOptionalRowId(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (typeof raw !== "string") {
    throw new Error('row "id" must be a nanoid string when provided');
  }
  const trimmed = raw.trim();
  if (!ROWID_PATTERN.test(trimmed)) {
    throw new Error(
      'row "id" must match nanoid alphabet [A-Za-z0-9_-] (1-64 chars)',
    );
  }
  return trimmed;
}

function rowExists(tableName: string, rowId: string): boolean {
  const found = getDatabase()
    .query(
      `SELECT 1 AS ok FROM ${quoteIdentExport(tableName)} WHERE id = ? LIMIT 1`,
    )
    .get(rowId);
  return found !== null && found !== undefined;
}

export function insertTableRow(
  table: TableRow,
  rowInput: Record<string, unknown>,
  onConflict: OnConflict = "abort",
): { id: string; changes: number; outcome: InsertOutcome } {
  const explicitId = parseOptionalRowId(rowInput.id);
  const rowId = explicitId ?? createRowId();
  const rowForValidation: Record<string, unknown> = { ...rowInput };
  delete rowForValidation.id;
  validateRowAgainstSchema(table.name, table.schema_json, rowForValidation);

  const columns = getTableColumns(table);
  const columnNames = ["id", ...columns.map((column) => column.name)];
  const values = [
    rowId,
    ...columns.map((column) =>
      encodeCellValue(rowForValidation[column.name], column),
    ),
  ];

  const insertKeyword =
    onConflict === "ignore"
      ? "INSERT OR IGNORE"
      : onConflict === "replace"
        ? "INSERT OR REPLACE"
        : "INSERT";
  const placeholders = columnNames.map(() => "?").join(", ");
  const sqlText = `${insertKeyword} INTO ${quoteIdentExport(table.name)} (${columnNames
    .map((name) => quoteIdentExport(name))
    .join(", ")}) VALUES (${placeholders})`;

  const existed =
    explicitId !== undefined &&
    (onConflict === "ignore" || onConflict === "replace")
      ? rowExists(table.name, explicitId)
      : false;

  const result = getDatabase().query(sqlText).run(...asBindings(values));

  if (onConflict === "ignore" && result.changes === 0) {
    return {
      id: rowId,
      changes: 0,
      outcome: "ignored",
    };
  }
  if (onConflict === "replace" && existed) {
    return {
      id: rowId,
      changes: result.changes,
      outcome: "replaced",
    };
  }
  return {
    id: rowId,
    changes: result.changes,
    outcome: "inserted",
  };
}
