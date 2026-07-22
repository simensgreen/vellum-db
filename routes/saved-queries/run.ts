import { parseRouteQuery } from "../../src/api/parse-request.ts";
import { RunSavedQueryQuerySchema } from "../../src/api/schemas/saved-queries.ts";
import { runSavedQueryView } from "../../src/core/saved-queries-api.ts";
import { handleRoute } from "../../src/core/route-http.ts";

export const description = "Run a saved named query";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, RunSavedQueryQuerySchema);
    return runSavedQueryView({
      name: query.name,
      params: query.params,
    });
  });
}
