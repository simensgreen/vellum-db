import { parseRouteRequest } from "../../src/api/parse-request.ts"
import { RowCommitBodySchema, RowCommitQuerySchema } from "../../src/api/schemas/rows.ts"
import { handleRoute } from "../../src/core/route-http.ts"
import { commitRowChanges } from "../../src/core/row-commit.ts"

export const description = "Apply row inserts, updates, and deletes in one transaction"

export async function POST(request: Request): Promise<Response> {
    return handleRoute(async () => {
        const { query, body } = await parseRouteRequest(request, {
            query: RowCommitQuerySchema,
            body: RowCommitBodySchema
        })
        return commitRowChanges({
            table: query.table,
            insert: body.insert,
            update: body.update,
            delete: body.delete
        })
    })
}
