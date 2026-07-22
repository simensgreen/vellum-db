import type {
  PluginHookFn,
  PluginInitContext,
} from "@vellumai/plugin-api";
import { ensureMetaSchema } from "../src/core/catalog.ts";
import {
  getDatabasePath,
  getWorkspaceDir,
  openDatabase,
  parseConfig,
  resolveWorkspaceDir,
} from "../src/db.ts";

const init: PluginHookFn<PluginInitContext> = async (ctx) => {
  ctx.logger.info({}, "Opening vellum-db sqlite database");
  const config = parseConfig(ctx.config);
  openDatabase(ctx.pluginStorageDir, config, {
    workspaceDir: resolveWorkspaceDir(ctx.pluginStorageDir),
  });
  ensureMetaSchema();
  ctx.logger.info(
    {
      maxRowsPerQuery: config.maxRowsPerQuery,
      rawSqlMode: config.rawSqlMode,
      databasePath: getDatabasePath(),
      workspaceDir: getWorkspaceDir(),
      pluginStorageDir: ctx.pluginStorageDir,
    },
    "vellum-db initialized",
  );
};

export default init;
