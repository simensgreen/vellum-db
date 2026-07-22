import { parseRouteBody, parseRouteQuery } from "../src/api/parse-request.ts";
import {
  CreateTableBodySchema,
  CreateTableQuerySchema,
  ListTablesQuerySchema,
} from "../src/api/schemas/tables.ts";
import { listTablesView } from "../src/core/list-tables.ts";
import { createTable } from "../src/core/table-ddl.ts";
import { handleRoute } from "../src/core/route-http.ts";

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
    const query = parseRouteQuery(request, CreateTableQuerySchema, {
      scope: true,
    });
    const schema = await parseRouteBody(request, CreateTableBodySchema);
    return createTable({
      name: query.name,
      schema,
      scope: query.scope,
    });
  });
}
