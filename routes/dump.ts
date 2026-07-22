import { parseRouteQuery } from "../src/api/parse-request.ts";
import { DumpTableQuerySchema } from "../src/api/schemas/io.ts";
import { dumpTableToFile } from "../src/core/table-io.ts";
import { handleRoute } from "../src/core/route-http.ts";

export const description = "Dump table rows to a workspace file";

export async function POST(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, DumpTableQuerySchema);
    return dumpTableToFile({
      table: query.table,
      path: query.path,
      mode: query.mode,
    });
  });
}
