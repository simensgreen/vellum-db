import { parseRouteBody } from "../src/api/parse-request.ts";
import { ApplyMigrationBodySchema } from "../src/api/schemas/migrate.ts";
import { applyMigration } from "../src/core/migrate.ts";
import { handleRoute } from "../src/core/route-http.ts";

export const description = "Apply a flat schema migration file";

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const body = await parseRouteBody(request, ApplyMigrationBodySchema);
    return applyMigration({
      path: body.path,
      hash: body.hash,
      id: body.id,
    });
  });
}
