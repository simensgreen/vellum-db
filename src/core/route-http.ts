import { getConfig } from "../db.ts";
import { formatZodError } from "../api/format-zod-error.ts";
import { z } from "zod";

export function clampLimit(limit: unknown): number {
  const config = getConfig();
  if (limit === undefined || limit === null) {
    return config.maxRowsPerQuery;
  }
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("limit must be a positive integer");
  }
  return Math.min(Math.floor(parsed), config.maxRowsPerQuery);
}

export function parseOffset(offset: unknown): number {
  if (offset === undefined || offset === null) {
    return 0;
  }
  const parsed = Number(offset);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("offset must be a non-negative integer");
  }
  return Math.floor(parsed);
}

export function parseJsonQueryParam(
  value: string | null,
  fieldName: string,
): unknown {
  if (value === null || value === "") {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must be valid JSON`);
  }
}

export function parseRequiredJsonQueryParam(
  value: string | null,
  fieldName: string,
): unknown {
  if (value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }
  return parseJsonQueryParam(value, fieldName);
}

export function requireQueryParam(
  params: URLSearchParams,
  name: string,
): string {
  const value = params.get(name);
  if (value === null || value === "") {
    throw new Error(`Missing query parameter: ${name}`);
  }
  return value;
}

export function optionalQueryParam(
  params: URLSearchParams,
  name: string,
): string | undefined {
  const value = params.get(name);
  if (value === null || value === "") {
    return undefined;
  }
  return value;
}

export function optionalScopeParam(
  params: URLSearchParams,
): string | null | undefined {
  if (!params.has("scope")) {
    return undefined;
  }
  const value = params.get("scope");
  if (value === null || value === "") {
    return null;
  }
  return value;
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") {
    throw new Error("Request body must be JSON");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

export function routeError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function routeOk(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function handleRoute<T>(
  handler: () => T | Promise<T>,
): Promise<Response> {
  try {
    const result = await handler();
    return routeOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return routeError(formatZodError(error), 400);
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("disabled") ? 403 : 400;
    return routeError(message, status);
  }
}
