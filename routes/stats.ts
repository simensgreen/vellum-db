import { parseRouteQuery } from "../src/api/parse-request.ts";
import { StatsQuerySchema } from "../src/api/schemas/stats.ts";
import { getDatabaseStats } from "../src/core/stats.ts";
import { handleRoute } from "../src/core/route-http.ts";

export const description = "Database overview statistics";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, StatsQuerySchema);
    return getDatabaseStats({
      granularity: query.granularity,
      limit: query.limit,
    });
  });
}
