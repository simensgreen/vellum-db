import { parseRouteQuery } from "../src/api/parse-request.ts"
import { LoadTableQuerySchema } from "../src/api/schemas/io.ts"
import { handleRoute } from "../src/core/route-http.ts"
import { loadTableFromFile } from "../src/core/table-io.ts"

export const description = "Load rows from a workspace file into a table"

export async function POST(request: Request): Promise<Response> {
    return handleRoute(() => {
        const params = new URL(request.url).searchParams
        const query = parseRouteQuery(request, LoadTableQuerySchema)
        return loadTableFromFile({
            table: query.table,
            path: query.path,
            mode: query.mode,
            on_conflict: params.has("on_conflict") ? query.on_conflict : undefined
        })
    })
}
