import { parseRouteQuery } from "../../src/api/parse-request.ts";
import { DeleteViewQuerySchema } from "../../src/api/schemas/views.ts";
import { deleteViewBySlug } from "../../src/core/views-api.ts";
import { handleRoute } from "../../src/core/route-http.ts";

export const description = "Delete a named view";

export async function DELETE(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, DeleteViewQuerySchema);
    return deleteViewBySlug(query.slug);
  });
}
