import type { ToolExecutionResult } from "@vellumai/plugin-api";
import { validateAgainstSchema } from "./schema-validate.ts";

export function ok(payload: unknown): ToolExecutionResult {
  return {
    content: JSON.stringify(payload, null, 2),
    isError: false,
  };
}

export function fail(message: string): ToolExecutionResult {
  return {
    content: JSON.stringify({ error: message }),
    isError: true,
  };
}

export function runTool(
  input: unknown,
  schema: object,
  execute: (validated: Record<string, unknown>) => unknown,
): ToolExecutionResult {
  try {
    validateAgainstSchema(schema, input, "tool input");
    const result = execute(input as Record<string, unknown>);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(message);
  }
}
