import { z } from "../zod.ts";

export const StatsGranularitySchema = z.enum(["day", "week", "month"], {
  message: 'granularity must be "day", "week", or "month"',
});

export const StatsQuerySchema = z.object({
  granularity: StatsGranularitySchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .positive({ message: "limit must be a positive integer" })
    .optional(),
});

export const StatsBucketSchema = z.object({
  start: z.string(),
  inserts: z.number().int().nonnegative(),
  updates: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  reads: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  table_count: z.number().int().nonnegative(),
  row_count: z.number().int().nonnegative(),
  database_bytes: z.number().int().nonnegative(),
});

export const DatabaseStatsSchema = z.object({
  summary: z.object({
    table_count: z.number().int().nonnegative(),
    row_count: z.number().int().nonnegative(),
    database_bytes: z.number().int().nonnegative(),
  }),
  retention_days: z.number().int().positive(),
  granularity: StatsGranularitySchema,
  buckets: z.array(StatsBucketSchema),
});
