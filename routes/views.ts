import { parseRouteQuery, parseRouteRequest } from "../src/api/parse-request.ts"
import {
    ListViewsQuerySchema,
    SaveViewBodySchema,
    SaveViewQuerySchema
} from "../src/api/schemas/views.ts"
import { handleRoute } from "../src/core/route-http.ts"
import { migrateSaveViewApi } from "../src/core/schema-migrate.ts"
import { listViewsView } from "../src/core/views-api.ts"

export const description = "List or save named views"

export async function GET(request: Request): Promise<Response> {
    return handleRoute(() => {
        const query = parseRouteQuery(request, ListViewsQuerySchema, {
            pagination: true
        })
        return listViewsView({
            kind: query.kind,
            scope: query.scope,
            slug_prefix: query.slug_prefix,
            limit: query.limit,
            offset: query.offset
        })
    })
}

export async function POST(request: Request): Promise<Response> {
    return handleRoute(async () => {
        const { query, body } = await parseRouteRequest(request, {
            query: SaveViewQuerySchema,
            body: SaveViewBodySchema
        })
        return migrateSaveViewApi({
            slug: query.slug,
            name: query.name,
            kind: query.kind,
            definition: body,
            description: query.description,
            scope: query.scope
        })
    })
}
