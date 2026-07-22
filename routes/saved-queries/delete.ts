import { parseRouteQuery } from "../../src/api/parse-request.ts";
import { DeleteSavedQueryQuerySchema } from "../../src/api/schemas/saved-queries.ts";
import { deleteSavedQueryByName } from "../../src/core/saved-queries-api.ts";
import { handleRoute } from "../../src/core/route-http.ts";

export const description = "Delete a saved named query";

export async function DELETE(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, DeleteSavedQueryQuerySchema);
    return deleteSavedQueryByName(query.name);
  });
}
