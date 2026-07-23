import { parseRouteQuery } from "../../src/api/parse-request.ts"
import { DropTableQuerySchema } from "../../src/api/schemas/tables.ts"
import { handleRoute } from "../../src/core/route-http.ts"
import { migrateDropTableApi } from "../../src/core/schema-migrate.ts"

export const description = "Drop a structured table"

export async function DELETE(request: Request): Promise<Response> {
    return handleRoute(() => {
        const query = parseRouteQuery(request, DropTableQuerySchema)
        return migrateDropTableApi({ table: query.table })
    })
}
