import { join, relative } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { ensureMetaSchema } from "../src/core/catalog.ts";
import {
  closeDatabase,
  openDatabase,
  parseConfig,
} from "../src/db.ts";
import { GET as listTablesGet, POST as createTablePost } from "../routes/tables.ts";
import { POST as alterTablePost } from "../routes/tables/alter.ts";
import { GET as queryRowsGet } from "../routes/rows.ts";
import { POST as commitRowsPost } from "../routes/rows/commit.ts";
import { GET as statsGet } from "../routes/stats.ts";
import { GET as exportTableGet } from "../routes/export.ts";
import { POST as importTablePost } from "../routes/import.ts";
import { tableDataTag } from "../apps/tables/src/sync-tags.ts";
import { GET as listViewsGet } from "../routes/views.ts";
import { GET as runViewGet } from "../routes/views/run.ts";
import { GET as listMigrationsGet } from "../routes/migrations.ts";
import { POST as migratePost } from "../routes/migrate.ts";
import { seedDevDashboardData } from "./seed-dev-dashboard.ts";

const ROOT = join(import.meta.dir, "..");
const APP_DIR = join(ROOT, "apps/tables");
const OUT_DIR = join(APP_DIR, ".dev/dist");
const API_PREFIX = "/v1/x/plugins/vellum-db";
const PORT = Number(process.env.PORT ?? 5173);

type RouteHandler = (request: Request) => Promise<Response>;

const routeHandlers: Record<string, Partial<Record<string, RouteHandler>>> = {
  "/tables": {
    GET: listTablesGet,
    POST: createTablePost,
  },
  "/tables/alter": {
    POST: alterTablePost,
  },
  "/rows": {
    GET: queryRowsGet,
  },
  "/rows/commit": {
    POST: commitRowsPost,
  },
  "/stats": {
    GET: statsGet,
  },
  "/export": {
    GET: exportTableGet,
  },
  "/import": {
    POST: importTablePost,
  },
  "/views": {
    GET: listViewsGet,
  },
  "/views/run": {
    GET: runViewGet,
  },
  "/migrations": {
    GET: listMigrationsGet,
  },
  "/migrate": {
    POST: migratePost,
  },
};

const reloadClients = new Set<ReadableStreamDefaultController<string>>();
const syncClients = new Set<ReadableStreamDefaultController<string>>();
let cssHref = "/dist/main.css";

function broadcastReload(): void {
  for (const client of reloadClients) {
    try {
      client.enqueue("data: reload\n\n");
    } catch {
      reloadClients.delete(client);
    }
  }
}

function broadcastSync(tags: readonly string[]): void {
  if (tags.length === 0) {
    return;
  }
  const payload = JSON.stringify({ tags: [...tags] });
  const message = `data: ${payload}\n\n`;
  for (const client of syncClients) {
    try {
      client.enqueue(message);
    } catch {
      syncClients.delete(client);
    }
  }
}

function devHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Database</title>
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.vellum = {
        fetch: (path, init) => fetch(path, init),
        subscribe: (filter, callback) => {
          const subscribedTags = new Set(filter.tags ?? []);
          const source = new EventSource("/__dev/sync");
          source.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data);
              const eventTags = Array.isArray(payload.tags) ? payload.tags : [];
              const matched = eventTags.some((tag) => subscribedTags.has(tag));
              if (matched) {
                callback({ tags: eventTags });
              }
            } catch {
              /* ignore malformed sync events */
            }
          };
          return () => source.close();
        },
      };
    </script>
    <script type="module" src="/dist/main.js"></script>
    <script>
      const reloadSource = new EventSource("/__dev/reload");
      reloadSource.onmessage = () => location.reload();
    </script>
  </body>
</html>`;
}

async function dispatchApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) {
    return null;
  }
  const routePath = url.pathname.slice(API_PREFIX.length) || "/";
  const handlers = routeHandlers[routePath];
  if (!handlers) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const handler = handlers[request.method];
  if (!handler) {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const proxiedUrl = new URL(request.url);
  proxiedUrl.pathname = routePath;
  const proxiedRequest = new Request(proxiedUrl, request);
  const response = await handler(proxiedRequest);

  if (
    routePath === "/rows/commit" &&
    request.method === "POST" &&
    response.ok
  ) {
    const tableName = url.searchParams.get("table");
    if (tableName) {
      broadcastSync([tableDataTag(tableName)]);
    }
  }

  if (
    routePath === "/import" &&
    request.method === "POST" &&
    response.ok
  ) {
    const tableName = url.searchParams.get("table");
    if (tableName) {
      broadcastSync([tableDataTag(tableName)]);
    }
  }

  if (
    routePath === "/tables" &&
    request.method === "POST" &&
    response.ok
  ) {
    broadcastSync(["vellum-db:tables"]);
  }

  if (
    routePath === "/tables/alter" &&
    request.method === "POST" &&
    response.ok
  ) {
    const tableName = url.searchParams.get("table");
    broadcastSync(
      tableName
        ? ["vellum-db:tables", tableDataTag(tableName)]
        : ["vellum-db:tables"],
    );
  }

  return response;
}

async function buildApp(watch: boolean): Promise<void> {
  const buildOptions = {
    entrypoints: [join(APP_DIR, "src/main.tsx")],
    outdir: OUT_DIR,
    target: "browser" as const,
    format: "esm" as const,
    splitting: false,
    minify: false,
    sourcemap: "inline" as const,
    jsx: {
      runtime: "automatic",
      importSource: "preact",
    },
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "vellum-db": join(ROOT, "src"),
    },
    ...(watch
      ? {
          watch: {
            onRebuild(error) {
              if (error) {
                console.error("App rebuild failed:", error.message);
                return;
              }
              console.log("App rebuilt");
              broadcastReload();
            },
          },
        }
      : {}),
  };

  const result = await Bun.build(buildOptions);
  if (!result.success) {
    console.error("Initial app build failed");
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }
  const cssOutput = result.outputs.find((output) => output.path.endsWith(".css"));
  if (cssOutput) {
    cssHref = `/dist/${cssOutput.path.split("/").pop()}`;
  }
  console.log("App built to", relative(ROOT, OUT_DIR));
}

function openDevDatabase(): string {
  const dir = mkdtempSync(join(tmpdir(), "vellum-db-dev-app-"));
  openDatabase(
    dir,
    parseConfig({ maxRowsPerQuery: 500, rawSqlMode: "select-only" }),
  );
  ensureMetaSchema();
  if (process.env.DEV_SEED !== "0") {
    seedDevDashboardData();
    console.log("Dev dashboard seed data loaded (set DEV_SEED=0 to skip)");
  }
  console.log("Dev database:", dir);
  return dir;
}

const dbDir = openDevDatabase();

process.on("SIGINT", () => {
  closeDatabase();
  rmSync(dbDir, { recursive: true, force: true });
  process.exit(0);
});

await buildApp(true);

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/__dev/reload") {
      let clientController: ReadableStreamDefaultController<string> | null = null;
      const stream = new ReadableStream<string>({
        start(controller) {
          clientController = controller;
          reloadClients.add(controller);
          controller.enqueue(": connected\n\n");
        },
        cancel() {
          if (clientController) {
            reloadClients.delete(clientController);
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    if (url.pathname === "/__dev/sync") {
      let clientController: ReadableStreamDefaultController<string> | null = null;
      const stream = new ReadableStream<string>({
        start(controller) {
          clientController = controller;
          syncClients.add(controller);
          controller.enqueue(": connected\n\n");
        },
        cancel() {
          if (clientController) {
            syncClients.delete(clientController);
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const apiResponse = await dispatchApi(request);
    if (apiResponse) {
      return apiResponse;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(devHtml(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname.startsWith("/dist/")) {
      const filePath = join(OUT_DIR, url.pathname.slice("/dist/".length));
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const contentType = url.pathname.endsWith(".css")
          ? "text/css; charset=utf-8"
          : undefined;
        return new Response(file, {
          headers: contentType ? { "Content-Type": contentType } : undefined,
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Database app dev server: http://localhost:${PORT}`);
console.log(`Card preview test: http://localhost:${PORT}/?preview=1`);
