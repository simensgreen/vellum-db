import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOpenApiDocument,
  serializeOpenApiDocument,
} from "../src/openapi/build.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(repoRoot, "openapi.json");

const document = buildOpenApiDocument();
writeFileSync(outputPath, serializeOpenApiDocument(document), "utf8");
console.log(`Wrote ${outputPath}`);
