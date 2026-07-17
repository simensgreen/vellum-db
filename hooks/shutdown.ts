import type {
  PluginHookFn,
  PluginShutdownContext,
} from "@vellumai/plugin-api";
import { closeDatabase } from "../src/db.ts";

const shutdown: PluginHookFn<PluginShutdownContext> = async (_ctx) => {
  closeDatabase();
};

export default shutdown;
