import { buildKnownTablesMap } from "../src/core/catalog.ts";
import { listTablesView } from "../src/core/list-tables.ts";
import { createTable } from "../src/core/table-ddl.ts";
import { assertTableDefinition } from "../src/core/table/index.ts";
import { parseRouteQuery } from "../src/api/parse-request.ts";
import { ListTablesQuerySchema } from "../src/api/schemas/tables.ts";
import {
  handleRoute,
  optionalScopeParam,
  parseJsonBody,
} from "../src/core/route-http.ts";

export const description = "List or create structured tables";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, ListTablesQuerySchema, {
      pagination: true,
      scope: true,
    });
    return listTablesView({
      scope: query.scope,
      name_prefix: query.name_prefix,
      limit: query.limit,
      offset: query.offset,
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const scope = optionalScopeParam(url.searchParams);
    const body = await parseJsonBody(request);
    const knownTables = buildKnownTablesMap();
    const definition = assertTableDefinition(body, { knownTables });
    return createTable({
      definition,
      ...(scope !== undefined ? { scope } : {}),
    });
  });
}
