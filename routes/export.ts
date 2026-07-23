import { ApiError, apiErrorResponse } from "../src/api/errors.ts"
import { zodErrorToApiError } from "../src/api/format-zod-error.ts"
import { parseRouteQuery } from "../src/api/parse-request.ts"
import { ExportTableQuerySchema } from "../src/api/schemas/io.ts"
import { z } from "../src/api/zod.ts"
import { routeErrorBody } from "../src/core/route-http.ts"
import { dumpTableToBuffer } from "../src/core/table-io.ts"

export const description = "Download table rows as a file (csv, json, jsonl, xlsx)"

export async function GET(request: Request): Promise<Response> {
    try {
        const query = parseRouteQuery(request, ExportTableQuerySchema)
        const exported = dumpTableToBuffer({
            table: query.table,
            mode: query.mode
        })
        return new Response(exported.body.slice(), {
            status: 200,
            headers: {
                "Content-Type": exported.contentType,
                "Content-Disposition": `attachment; filename="${exported.filename}"`,
                "X-Row-Count": String(exported.count)
            }
        })
    } catch (error) {
        if (error instanceof ApiError) {
            return apiErrorResponse(error)
        }
        if (error instanceof z.ZodError) {
            return routeErrorBody(zodErrorToApiError(error), 400)
        }
        const message = error instanceof Error ? error.message : "Internal server error"
        return Response.json({ type: "bad_request", msg: message }, { status: 400 })
    }
}
