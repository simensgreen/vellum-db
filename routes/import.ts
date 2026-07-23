import { parseRouteQuery } from "../src/api/parse-request.ts"
import { ImportTableQuerySchema } from "../src/api/schemas/io.ts"
import { handleRoute } from "../src/core/route-http.ts"
import { ioModeFromFilename, loadTableFromBuffer } from "../src/core/table-io.ts"

export const description = "Upload a file and load rows into a table"

export async function POST(request: Request): Promise<Response> {
    return handleRoute(async () => {
        const params = new URL(request.url).searchParams
        const query = parseRouteQuery(request, ImportTableQuerySchema)
        const body = new Uint8Array(await request.arrayBuffer())
        if (body.byteLength === 0) {
            throw new Error("Request body must contain file data")
        }
        const filename = query.filename
        let mode = query.mode
        if (!mode) {
            if (!filename) {
                throw new Error("Provide query parameter mode or filename")
            }
            mode = ioModeFromFilename(filename)
        }
        return loadTableFromBuffer({
            table: query.table,
            mode,
            body,
            on_conflict: params.has("on_conflict") ? query.on_conflict : undefined
        })
    })
}
