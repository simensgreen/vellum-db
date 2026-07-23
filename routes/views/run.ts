import { parseRouteQuery } from "../../src/api/parse-request.ts";
import { RunViewQuerySchema } from "../../src/api/schemas/views.ts";
import { runView } from "../../src/core/views-api.ts";
import { handleRoute } from "../../src/core/route-http.ts";

export const description = "Run a named view";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, RunViewQuerySchema);
    return runView({
      slug: query.slug,
      params: query.params,
    });
  });
}
