import { getTableColumns, listTables } from "./catalog.ts";

export function listTablesView(input: {
  scope?: string | null;
  name_prefix?: string;
  limit?: number;
  offset?: number;
}) {
  const page = listTables({
    scope: input.scope,
    name_prefix: input.name_prefix,
    limit: input.limit,
    offset: input.offset,
  });
  return {
    tables: page.tables.map((table) => ({
      name: table.name,
      scope: table.scope,
      schema: JSON.parse(table.schema_json),
      columns: getTableColumns(table),
      created_at: table.created_at,
      updated_at: table.updated_at,
    })),
    count: page.count,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
  };
}
