import { parseRouteBody, parseRouteQuery } from "../../src/api/parse-request.ts"
import { AlterTableBodySchema, AlterTableQuerySchema } from "../../src/api/schemas/tables.ts"
import { handleRoute } from "../../src/core/route-http.ts"
import { migrateAlterTableApi } from "../../src/core/schema-migrate.ts"
import type { TableDefinition } from "../../src/core/table/types.ts"

export const description = "Alter a structured table"

export async function POST(request: Request): Promise<Response> {
    return handleRoute(async () => {
        const query = parseRouteQuery(request, AlterTableQuerySchema, { scope: true })
        const body = await parseRouteBody(request, AlterTableBodySchema)
        const alterInput: {
            table: string
            add?: Array<{
                name: string
                slug: string
                column: TableDefinition["columns"][number]
            }>
            drop?: string[]
            scope?: string | null
        } = {
            table: query.table,
            add: body.add?.map((entry) => ({
                name: entry.name,
                slug: entry.slug,
                column: entry.column as TableDefinition["columns"][number]
            })),
            drop: body.drop
        }
        if (Object.hasOwn(query, "scope")) {
            alterInput.scope = query.scope ?? null
        }
        return migrateAlterTableApi(alterInput)
    })
}
