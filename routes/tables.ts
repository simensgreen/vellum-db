import { parseRouteQuery } from "../src/api/parse-request.ts"
import { CreateTableScopeQuerySchema, ListTablesQuerySchema } from "../src/api/schemas/tables.ts"
import { buildKnownTablesMap } from "../src/core/catalog.ts"
import { listTablesView } from "../src/core/list-tables.ts"
import { handleRoute, parseJsonBody } from "../src/core/route-http.ts"
import { migrateCreateTableApi } from "../src/core/schema-migrate.ts"
import { assertTableDefinition } from "../src/core/table/index.ts"

export const description = "List or create structured tables"

export async function GET(request: Request): Promise<Response> {
    return handleRoute(() => {
        const query = parseRouteQuery(request, ListTablesQuerySchema, {
            pagination: true,
            scope: true
        })
        return listTablesView({
            scope: query.scope,
            name_prefix: query.name_prefix,
            limit: query.limit,
            offset: query.offset
        })
    })
}

export async function POST(request: Request): Promise<Response> {
    return handleRoute(async () => {
        const query = parseRouteQuery(request, CreateTableScopeQuerySchema)
        const body = await parseJsonBody(request)
        const knownTables = buildKnownTablesMap()
        const definition = assertTableDefinition(body, { knownTables })
        return migrateCreateTableApi({
            definition,
            scope: query.scope
        })
    })
}
