import { parseRouteBody } from "../src/api/parse-request.ts"
import { ExecuteSqlBodySchema } from "../src/api/schemas/sql.ts"
import { handleRoute } from "../src/core/route-http.ts"
import { executeRawSql } from "../src/core/sql.ts"
import { getConfig } from "../src/db.ts"

export const description = "Run raw SQL (gated by config.rawSqlMode)"

export async function POST(request: Request): Promise<Response> {
    if (getConfig().rawSqlMode === "off") {
        return Response.json(
            {
                type: "forbidden",
                msg: "db_sql is disabled (config.rawSqlMode = off)"
            },
            { status: 403 }
        )
    }
    return handleRoute(async () => {
        const body = await parseRouteBody(request, ExecuteSqlBodySchema)
        return executeRawSql(body.sql)
    })
}
