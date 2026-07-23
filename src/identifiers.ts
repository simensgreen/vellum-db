const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
const RESERVED_TABLE_PREFIX = "_";

export function assertSafeIdentifier(
  value: string,
  kind: "table" | "column" | "query" | "view",
): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${kind} name "${value}": must match [a-z][a-z0-9_]*`,
    );
  }
  if (kind === "table" && value.startsWith(RESERVED_TABLE_PREFIX)) {
    throw new Error(
      `Invalid table name "${value}": names starting with "_" are reserved`,
    );
  }
  return value;
}

export function isSafeIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}
