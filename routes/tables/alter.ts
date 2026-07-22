import {
  parseRouteBody,
  parseRouteQuery,
  parseScopeFromParams,
} from "../../src/api/parse-request.ts";
import {
  AlterTableBodySchema,
  AlterTableQuerySchema,
} from "../../src/api/schemas/tables.ts";
import { alterTable } from "../../src/core/table-ddl.ts";
import { handleRoute } from "../../src/core/route-http.ts";

export const description = "Alter a structured table";

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const params = new URL(request.url).searchParams;
    const query = parseRouteQuery(request, AlterTableQuerySchema);
    const body = await parseRouteBody(request, AlterTableBodySchema);
    const alterInput: {
      table: string;
      add?: Array<{ name: string; schema: unknown }>;
      drop?: string[];
      scope?: string | null;
    } = {
      table: query.table,
      add: body.add,
      drop: body.drop,
    };
    if (params.has("scope")) {
      alterInput.scope = parseScopeFromParams(params) ?? null;
    }
    return alterTable(alterInput);
  });
}
