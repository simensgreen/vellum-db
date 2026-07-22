import type { ZodError } from "zod";

export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Invalid input";
  }
  const path = issue.path.map(String).join(".");
  if (
    issue.code === "invalid_type" &&
    issue.input === undefined &&
    path.length > 0
  ) {
    return `Missing query parameter: ${path}`;
  }
  return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
}
