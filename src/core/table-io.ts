import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import * as XLSX from "xlsx";
import {
  decodeRow,
  getTableColumns,
  quoteIdentExport,
  requireTable,
  type ColumnSpec,
  type TableRow,
} from "./catalog.ts";
import { getDatabase, getWorkspaceDir } from "../db.ts";
import {
  insertTableRow,
  parseOnConflict,
  parseOptionalRowId,
  type OnConflict,
} from "./insert.ts";
import {
  assertTableJsonSchema,
  type JsonSchemaObject,
} from "../schema-validate.ts";
import { invalidationTagsForRowMutation } from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";

export type IoMode = "csv" | "json" | "jsonl" | "xls";

function assertInsideWorkspace(resolvedPath: string): string {
  const workspace = getWorkspaceDir();
  const relativePath = relative(workspace, resolvedPath);
  if (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  ) {
    return resolvedPath;
  }
  throw new Error(`path must stay within the workspace (${workspace})`);
}

export function resolveIoPath(pathInput: string): string {
  if (typeof pathInput !== "string" || pathInput.trim() === "") {
    throw new Error("path must be a non-empty string");
  }
  const trimmed = pathInput.trim();
  const resolved = isAbsolute(trimmed)
    ? resolve(trimmed)
    : resolve(getWorkspaceDir(), trimmed);
  return assertInsideWorkspace(resolved);
}

function propertyTypeName(
  schema: JsonSchemaObject,
  columnName: string,
): string | undefined {
  const propertySchema = schema.properties?.[columnName];
  if (propertySchema === null || typeof propertySchema !== "object") {
    return undefined;
  }
  const typeValue = (propertySchema as Record<string, unknown>).type;
  return Array.isArray(typeValue) ? String(typeValue[0]) : String(typeValue);
}

function coerceCellValue(
  raw: unknown,
  column: ColumnSpec,
  schema: JsonSchemaObject,
): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "string" && raw.trim() === "") {
    return null;
  }

  const typeName = propertyTypeName(schema, column.name);

  if (column.jsonStored) {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(
          `Column "${column.name}" expects JSON object/array; got invalid JSON`,
        );
      }
    }
    return raw;
  }

  if (typeName === "boolean") {
    if (typeof raw === "boolean") {
      return raw;
    }
    if (typeof raw === "number") {
      return raw !== 0;
    }
    const text = String(raw).trim().toLowerCase();
    if (text === "true" || text === "1" || text === "yes") {
      return true;
    }
    if (text === "false" || text === "0" || text === "no") {
      return false;
    }
    throw new Error(`Column "${column.name}" expects a boolean`);
  }

  if (column.sqlType === "INTEGER") {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.trunc(raw);
    }
    const text = String(raw).trim();
    if (!/^-?\d+$/.test(text)) {
      throw new Error(`Column "${column.name}" expects an integer`);
    }
    return Number(text);
  }

  if (column.sqlType === "REAL") {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    const parsed = Number(String(raw).trim());
    if (!Number.isFinite(parsed)) {
      throw new Error(`Column "${column.name}" expects a number`);
    }
    return parsed;
  }

  return typeof raw === "string" ? raw : String(raw);
}

function normalizeLoadedRow(
  rawRow: Record<string, unknown>,
  table: TableRow,
  columns: ColumnSpec[],
  schema: JsonSchemaObject,
  rowIndex: number,
): Record<string, unknown> {
  const known = new Set(columns.map((column) => column.name));
  for (const key of Object.keys(rawRow)) {
    if (key === "id") {
      continue;
    }
    if (!known.has(key)) {
      throw new Error(
        `Row ${rowIndex}: unknown column "${key}" for table "${table.name}"`,
      );
    }
  }
  const row: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(rawRow, "id")) {
    try {
      const rowId = parseOptionalRowId(rawRow.id);
      if (rowId !== undefined) {
        row.id = rowId;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Row ${rowIndex}: ${message}`);
    }
  }
  for (const column of columns) {
    if (!Object.prototype.hasOwnProperty.call(rawRow, column.name)) {
      continue;
    }
    try {
      row[column.name] = coerceCellValue(
        rawRow[column.name],
        column,
        schema,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Row ${rowIndex}: ${message}`);
    }
  }
  return row;
}

function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell.length > 0) || row.length > 1) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0]!.map((header) => header.trim());
  if (headers.some((header) => header === "")) {
    throw new Error("CSV header row contains an empty column name");
  }
  const result: Record<string, unknown>[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex]!;
    const object: Record<string, unknown> = {};
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      object[headers[columnIndex]!] = cells[columnIndex] ?? "";
    }
    result.push(object);
  }
  return result;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function serializeCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function readRowsFromFile(path: string, mode: IoMode): Record<string, unknown>[] {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  if (mode === "json") {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("JSON file must contain an array of row objects");
    }
    return parsed.map((item, index) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`JSON row ${index + 1} must be an object`);
      }
      return item as Record<string, unknown>;
    });
  }
  if (mode === "jsonl") {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    const rows: Record<string, unknown>[] = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!.trim();
      if (line === "") {
        continue;
      }
      const parsed = JSON.parse(line) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`JSONL line ${lineIndex + 1} must be an object`);
      }
      rows.push(parsed as Record<string, unknown>);
    }
    return rows;
  }
  if (mode === "csv") {
    return parseCsv(readFileSync(path, "utf8"));
  }
  const workbook = XLSX.read(readFileSync(path), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel workbook has no sheets");
  }
  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return rows;
}

function writeRowsToFile(
  path: string,
  mode: IoMode,
  rows: Record<string, unknown>[],
  headers: string[],
  sheetName: string,
): void {
  mkdirSync(dirname(path), { recursive: true });
  if (mode === "json") {
    writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    return;
  }
  if (mode === "jsonl") {
    const body = rows.map((row) => JSON.stringify(row)).join("\n");
    writeFileSync(path, body === "" ? "" : `${body}\n`, "utf8");
    return;
  }
  if (mode === "csv") {
    writeFileSync(path, serializeCsv(rows, headers), "utf8");
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  const safeSheetName = sheetName.slice(0, 31) || "Sheet1";
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
  writeFileSync(path, buffer);
}

function fetchAllDecodedRows(table: TableRow): Record<string, unknown>[] {
  const columns = getTableColumns(table);
  const selectList = ["id", ...columns.map((column) => column.name)]
    .map((name) => quoteIdentExport(name))
    .join(", ");
  const rawRows = getDatabase()
    .query(
      `SELECT ${selectList} FROM ${quoteIdentExport(table.name)} ORDER BY id`,
    )
    .all() as Record<string, unknown>[];
  return rawRows.map((row) => decodeRow(row, columns));
}

function insertRows(
  table: TableRow,
  rows: Record<string, unknown>[],
  onConflict: OnConflict,
): { inserted: number; ignored: number; replaced: number } {
  const columns = getTableColumns(table);
  const schema = assertTableJsonSchema(JSON.parse(table.schema_json));
  const database = getDatabase();
  let inserted = 0;
  let ignored = 0;
  let replaced = 0;
  database.run("BEGIN");
  try {
    for (let index = 0; index < rows.length; index += 1) {
      const normalized = normalizeLoadedRow(
        rows[index]!,
        table,
        columns,
        schema,
        index + 1,
      );
      const result = insertTableRow(table, normalized, onConflict);
      if (result.outcome === "ignored") {
        ignored += 1;
      } else if (result.outcome === "replaced") {
        replaced += 1;
      } else {
        inserted += 1;
      }
    }
    database.run("COMMIT");
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
  return { inserted, ignored, replaced };
}

export function loadTableFromFile(input: {
  table: string;
  path: string;
  mode: IoMode;
  on_conflict?: OnConflict;
}): {
  table: string;
  path: string;
  mode: IoMode;
  on_conflict: OnConflict;
  inserted: number;
  ignored: number;
  replaced: number;
} {
  const table = requireTable(input.table);
  const path = resolveIoPath(input.path);
  const onConflict = parseOnConflict(input.on_conflict);
  const rows = readRowsFromFile(path, input.mode);
  const counts = insertRows(table, rows, onConflict);
  if (counts.inserted > 0 || counts.replaced > 0) {
    notifyInvalidation(invalidationTagsForRowMutation(table.name));
  }
  return {
    table: table.name,
    path,
    mode: input.mode,
    on_conflict: onConflict,
    inserted: counts.inserted,
    ignored: counts.ignored,
    replaced: counts.replaced,
  };
}

export function dumpTableToFile(input: {
  table: string;
  path: string;
  mode: IoMode;
}): { table: string; path: string; mode: IoMode; count: number } {
  const table = requireTable(input.table);
  const path = resolveIoPath(input.path);
  const rows = fetchAllDecodedRows(table);
  const columns = getTableColumns(table);
  const headers = ["id", ...columns.map((column) => column.name)];
  writeRowsToFile(path, input.mode, rows, headers, table.name);
  return {
    table: table.name,
    path,
    mode: input.mode,
    count: rows.length,
  };
}
