import {
  alterUserTable,
  createUserTable,
  dropUserTable,
  getTableColumns,
} from "./catalog.ts";
import { invalidationTagsForCatalogChange } from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";

export function createTable(input: {
  name: string;
  schema: unknown;
  scope?: string | null;
}) {
  const table = createUserTable(input.name, input.schema, {
    scope: input.scope,
  });
  notifyInvalidation(invalidationTagsForCatalogChange(table.name));
  return {
    name: table.name,
    scope: table.scope,
    schema: JSON.parse(table.schema_json),
    columns: getTableColumns(table).map((column) => column.name),
    created_at: table.created_at,
  };
}

export function alterTable(input: {
  table: string;
  add?: Array<{ name: string; schema: unknown }>;
  drop?: string[];
  scope?: string | null;
}) {
  const table = alterUserTable({
    table: input.table,
    add: input.add,
    drop: input.drop,
    ...(Object.prototype.hasOwnProperty.call(input, "scope")
      ? { scope: input.scope }
      : {}),
  });
  notifyInvalidation(invalidationTagsForCatalogChange(table.name));
  return {
    name: table.name,
    scope: table.scope,
    schema: JSON.parse(table.schema_json),
    columns: getTableColumns(table).map((column) => column.name),
    updated_at: table.updated_at,
  };
}

export function dropTable(input: { table: string }) {
  const result = dropUserTable(input.table);
  notifyInvalidation(invalidationTagsForCatalogChange(result.name));
  return result;
}
