import { parseRouteQuery } from "../src/api/parse-request.ts"
import { ListMigrationsQuerySchema } from "../src/api/schemas/migrate.ts"
import { listMigrationsView } from "../src/core/migrate.ts"
import { handleRoute } from "../src/core/route-http.ts"

export const description = "List applied schema migrations"

export async function GET(request: Request): Promise<Response> {
    return handleRoute(() => {
        const query = parseRouteQuery(request, ListMigrationsQuerySchema, {
            pagination: true
        })
        return listMigrationsView({
            limit: query.limit,
            offset: query.offset
        })
    })
}
