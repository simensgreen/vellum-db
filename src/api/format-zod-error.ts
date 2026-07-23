import type { ZodError } from "zod";
import type { ApiErrorBody } from "./errors.ts";

export function zodErrorToApiError(error: ZodError): ApiErrorBody {
  const issue = error.issues[0];
  if (!issue) {
    return {
      type: "validation_error",
      msg: "Invalid input",
      hint: "Fix request parameters or body to match the API schema",
    };
  }
  const path = issue.path.map(String).join(".");
  const msg = path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  let hint = `Fix field ${path || "input"}: ${issue.message}`;
  if (
    issue.code === "invalid_type" &&
    issue.input === undefined &&
    path.length > 0
  ) {
    hint = `Provide query parameter: ${path}`;
  }
  return {
    type: "validation_error",
    msg,
    hint,
  };
}

/** @deprecated use zodErrorToApiError — kept for imports during Zod removal */
export function formatZodError(error: ZodError): string {
  const body = zodErrorToApiError(error);
  return body.msg ?? body.type;
}
