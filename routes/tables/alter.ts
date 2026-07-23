import {
  parseRouteBody,
  parseRouteQuery,
  parseScopeFromParams,
} from "../../src/api/parse-request.ts";
import {
  AlterTableBodySchema,
  AlterTableQuerySchema,
} from "../../src/api/schemas/tables.ts";
import { migrateAlterTableApi } from "../../src/core/schema-migrate.ts";
import type { TableDefinition } from "../../src/core/table/types.ts";
import { handleRoute } from "../../src/core/route-http.ts";

export const description = "Alter a structured table";

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const params = new URL(request.url).searchParams;
    const query = parseRouteQuery(request, AlterTableQuerySchema);
    const body = await parseRouteBody(request, AlterTableBodySchema);
    const alterInput: {
      table: string;
      add?: Array<{
        name: string;
        slug: string;
        column: TableDefinition["columns"][number];
      }>;
      drop?: string[];
      scope?: string | null;
    } = {
      table: query.table,
      add: body.add?.map((entry) => ({
        name: entry.name,
        slug: entry.slug,
        column: entry.column as TableDefinition["columns"][number],
      })),
      drop: body.drop,
    };
    if (params.has("scope")) {
      alterInput.scope = parseScopeFromParams(params) ?? null;
    }
    return migrateAlterTableApi(alterInput);
  });
}
