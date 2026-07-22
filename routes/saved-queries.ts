import {
  parseRouteBody,
  parseRouteQuery,
  parseRouteRequest,
} from "../src/api/parse-request.ts";
import {
  ListSavedQueriesQuerySchema,
  SaveSavedQueryBodySchema,
  SaveSavedQueryQuerySchema,
} from "../src/api/schemas/saved-queries.ts";
import {
  listSavedQueriesView,
  saveSavedQuery,
} from "../src/core/saved-queries-api.ts";
import { handleRoute } from "../src/core/route-http.ts";

export const description = "List or save named queries";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, ListSavedQueriesQuerySchema, {
      pagination: true,
    });
    return listSavedQueriesView({
      kind: query.kind,
      name_prefix: query.name_prefix,
      limit: query.limit,
      offset: query.offset,
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const { query, body } = await parseRouteRequest(request, {
      query: SaveSavedQueryQuerySchema,
      body: SaveSavedQueryBodySchema,
    });
    return saveSavedQuery({
      name: query.name,
      kind: query.kind,
      definition: body,
      description: query.description,
    });
  });
}
