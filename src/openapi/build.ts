import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenApiRegistry } from "./registry.ts";

function readPluginVersion(): string {
  const packagePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../package.json",
  );
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    version?: string;
  };
  return packageJson.version ?? "0.0.0";
}

export function buildOpenApiDocument() {
  const registry = createOpenApiRegistry();
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "vellum-db REST API",
      version: readPluginVersion(),
      description:
        "HTTP API for the vellum-db Vellum plugin. Same capabilities as db_* tools. " +
        "Reads use query parameters (JSON fields URL-encoded). Mutations put table/name scalars in query and payload in JSON body.",
    },
    servers: [
      {
        url: "/v1/x/plugins/vellum-db",
        description: "Vellum gateway (requires settings.read)",
      },
    ],
    tags: [
      { name: "tables", description: "Table catalog and DDL" },
      { name: "rows", description: "Row CRUD and query" },
      { name: "aggregate", description: "Aggregations" },
      { name: "views", description: "Named query and aggregate views" },
      { name: "io", description: "Import and export" },
      { name: "migrations", description: "Schema migration history and apply" },
      { name: "sql", description: "Raw SQL escape hatch" },
    ],
  });
}

export function serializeOpenApiDocument(
  document: ReturnType<typeof buildOpenApiDocument>,
): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
