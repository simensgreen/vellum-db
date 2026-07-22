import { parseRouteQuery } from "../../src/api/parse-request.ts";
import { DropTableQuerySchema } from "../../src/api/schemas/tables.ts";
import { dropTable } from "../../src/core/table-ddl.ts";
import { handleRoute } from "../../src/core/route-http.ts";

export const description = "Drop a structured table";

export async function DELETE(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, DropTableQuerySchema);
    return dropTable({ table: query.table });
  });
}
