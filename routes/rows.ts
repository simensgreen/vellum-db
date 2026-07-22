import {
  parseRouteQuery,
  parseRouteRequest,
} from "../src/api/parse-request.ts";
import {
  DeleteRowsBodySchema,
  DeleteRowsQuerySchema,
  InsertRowBodySchema,
  InsertRowQuerySchema,
  QueryRowsQuerySchema,
  UpdateRowsBodySchema,
  UpdateRowsQuerySchema,
} from "../src/api/schemas/rows.ts";
import {
  buildQueryDefinition,
  executeQueryDefinition,
} from "../src/core/query.ts";
import { insertRow } from "../src/core/rows.ts";
import { updateRows } from "../src/core/update.ts";
import { deleteRows } from "../src/core/delete.ts";
import { handleRoute } from "../src/core/route-http.ts";

export const description = "Query, insert, update, or delete table rows";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(() => {
    const query = parseRouteQuery(request, QueryRowsQuerySchema, {
      pagination: true,
    });
    return executeQueryDefinition(
      buildQueryDefinition({
        table: query.table,
        filter: query.filter,
        order: query.order,
        limit: query.limit,
        offset: query.offset,
        columns: query.columns,
      }),
    );
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const params = new URL(request.url).searchParams;
    const { query, body } = await parseRouteRequest(request, {
      query: InsertRowQuerySchema,
      body: InsertRowBodySchema,
    });
    return insertRow({
      table: query.table,
      row: body,
      on_conflict: params.has("on_conflict") ? query.on_conflict : undefined,
    });
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const { query, body } = await parseRouteRequest(request, {
      query: UpdateRowsQuerySchema,
      body: UpdateRowsBodySchema,
    });
    return updateRows({
      table: query.table,
      filter: body.filter,
      patch: body.patch,
    });
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const { query, body } = await parseRouteRequest(request, {
      query: DeleteRowsQuerySchema,
      body: DeleteRowsBodySchema,
    });
    return deleteRows({
      table: query.table,
      filter: body.filter,
    });
  });
}
