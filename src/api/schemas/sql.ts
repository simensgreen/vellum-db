import { z } from "../zod.ts"

export const ExecuteSqlBodySchema = z.object({
    sql: z.string().trim().min(1, { message: "sql is required" })
})
