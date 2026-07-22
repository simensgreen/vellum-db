import { randomUUID } from "node:crypto";
import { assistantEventHub } from "@vellumai/plugin-api";

export function notifyInvalidation(tags: readonly string[]): void {
  if (typeof assistantEventHub?.publish !== "function") {
    return;
  }
  void assistantEventHub.publish({
    id: randomUUID(),
    emittedAt: new Date().toISOString(),
    message: { type: "sync_changed", tags: [...new Set(tags)] },
  });
}
