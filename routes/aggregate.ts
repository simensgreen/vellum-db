import { parseRouteQuery } from "../src/api/parse-request.ts"
import { AggregateRowsQuerySchema } from "../src/api/schemas/rows.ts"
import { buildAggregateDefinition, executeAggregateDefinition } from "../src/core/aggregate.ts"
import { handleRoute } from "../src/core/route-http.ts"

export const description = "Aggregate table rows"

export async function GET(request: Request): Promise<Response> {
    return handleRoute(() => {
        const query = parseRouteQuery(request, AggregateRowsQuerySchema, {
            pagination: true
        })
        return executeAggregateDefinition(
            buildAggregateDefinition({
                table: query.table,
                metrics: query.metrics,
                group_by: query.group_by,
                filter: query.filter,
                having: query.having,
                order: query.order,
                joins: query.joins,
                limit: query.limit,
                offset: query.offset
            })
        )
    })
}
