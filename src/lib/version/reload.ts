import type { QueryClient } from "@tanstack/react-query";
import { hasUnsavedWork } from "./dirty-registry";
import { markReloadAttempt } from "./service";
import { broadcast } from "./channel";

export type ReloadBlock =
  | { ok: true }
  | { ok: false; reason: "mutating" | "dirty" | "offline" };

export function canReloadNow(queryClient: QueryClient): ReloadBlock {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, reason: "offline" };
  }
  if (queryClient.isMutating() > 0) return { ok: false, reason: "mutating" };
  if (hasUnsavedWork()) return { ok: false, reason: "dirty" };
  return { ok: true };
}

export function performReload(targetBuildId: string) {
  if (typeof window === "undefined") return;
  markReloadAttempt(targetBuildId);
  broadcast({ kind: "reload_started", buildId: targetBuildId });
  window.location.reload();
}