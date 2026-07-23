import {
  parseRouteBody,
  parseRouteQuery,
  parseRouteRequest,
} from "../src/api/parse-request.ts";
import {
  ListViewsQuerySchema,
  SaveViewBodySchema,
  SaveViewQuerySchema,
} from "../src/api/schemas/views.ts";
import { listViewsView, saveViewApi } from "../src/core/views-api.ts";
import { handleRoute } from "../src/core/route-http.ts";

export const description = "List or save named views";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, ListViewsQuerySchema, {
      pagination: true,
    });
    return listViewsView({
      kind: query.kind,
      scope: query.scope,
      slug_prefix: query.slug_prefix,
      limit: query.limit,
      offset: query.offset,
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const { query, body } = await parseRouteRequest(request, {
      query: SaveViewQuerySchema,
      body: SaveViewBodySchema,
    });
    return saveViewApi({
      slug: query.slug,
      name: query.name,
      kind: query.kind,
      definition: body,
      description: query.description,
      scope: query.scope,
    });
  });
}
