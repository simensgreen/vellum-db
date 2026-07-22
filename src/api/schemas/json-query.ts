import { z } from "../zod.ts";

export function optionalJsonQueryString(fieldName: string) {
  return z.string().optional().transform((value, context) => {
    if (value === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message: `${fieldName} must be valid JSON`,
      });
      return z.NEVER;
    }
  });
}

export function requiredJsonQueryString(fieldName: string) {
  return z
    .string()
    .min(1, { message: `${fieldName} is required` })
    .transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({
          code: "custom",
          message: `${fieldName} must be valid JSON`,
        });
        return z.NEVER;
      }
    });
}

export function parseJsonQueryValue<TSchema extends z.ZodType>(
  value: unknown,
  fieldName: string,
  schema: TSchema,
): z.infer<TSchema> | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    return schema.parse(value);
  }
  try {
    return schema.parse(JSON.parse(value));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new Error(`${fieldName} must be valid JSON`);
  }
}
