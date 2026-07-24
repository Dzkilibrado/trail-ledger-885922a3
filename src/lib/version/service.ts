import { LOCAL_BUILD } from "./build-info";
import type { RemoteAppVersion, UpdateReason, VersionState } from "./types";

const ENDPOINT = "/api/public/app-version";
const MIN_CHECK_INTERVAL_MS = 60_000;

type Listener = (state: VersionState) => void;

let state: VersionState = {
  updateAvailable: false,
  remote: null,
  lastCheckedAt: null,
  lastError: null,
};
let inFlight: Promise<VersionState> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(state);
}

function setState(patch: Partial<VersionState>) {
  state = { ...state, ...patch };
  emit();
}

export function getVersionState(): VersionState {
  return state;
}

export function subscribeVersion(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parsePayload(raw: unknown): RemoteAppVersion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.currentVersion !== "string" || typeof o.buildId !== "string") return null;
  return {
    currentVersion: o.currentVersion,
    buildId: o.buildId,
    publishedAt: typeof o.publishedAt === "string" ? o.publishedAt : "",
    releaseMessage: typeof o.releaseMessage === "string" ? o.releaseMessage : null,
    minimumSupportedVersion:
      typeof o.minimumSupportedVersion === "string" ? o.minimumSupportedVersion : null,
    forceUpdate: o.forceUpdate === true,
    requiresReauthentication: o.requiresReauthentication === true,
  };
}

export function detectUpdate(remote: RemoteAppVersion): {
  updateAvailable: boolean;
  reason: UpdateReason;
} {
  if (remote.buildId && remote.buildId !== LOCAL_BUILD.buildId) {
    return { updateAvailable: true, reason: "build_id" };
  }
  if (remote.currentVersion && remote.currentVersion !== LOCAL_BUILD.appVersion) {
    return { updateAvailable: true, reason: "app_version" };
  }
  return { updateAvailable: false, reason: "unknown" };
}

export async function checkForUpdate(opts: { force?: boolean } = {}): Promise<VersionState> {
  if (typeof window === "undefined") return state;
  if (!opts.force && state.lastCheckedAt) {
    if (Date.now() - state.lastCheckedAt < MIN_CHECK_INTERVAL_MS) return state;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) return state;
  if (inFlight) return inFlight;

  const ctrl = new AbortController();
  const timeout = window.setTimeout(() => ctrl.abort(), 6_000);
  inFlight = (async () => {
    try {
      const res = await fetch(ENDPOINT, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        headers: { accept: "application/json" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const remote = parsePayload(await res.json());
      if (!remote) throw new Error("invalid_payload");
      const { updateAvailable } = detectUpdate(remote);
      setState({
        remote,
        updateAvailable: updateAvailable || state.updateAvailable,
        lastCheckedAt: Date.now(),
        lastError: null,
      });
    } catch (err) {
      setState({
        lastCheckedAt: Date.now(),
        lastError: err instanceof Error ? err.message : "unknown_error",
      });
    } finally {
      window.clearTimeout(timeout);
      inFlight = null;
    }
    return state;
  })();
  return inFlight;
}

// ---- Guard contra loop de reload ----
const KEY_TARGET = "tb_update_target_build";
const KEY_ATTEMPTS = "tb_update_reload_attempts";
const KEY_LAST = "tb_update_last_attempt_at";
const MAX_ATTEMPTS = 2;
const LOOP_WINDOW_MS = 5 * 60_000;

export function canAttemptReloadTo(targetBuildId: string): boolean {
  try {
    const target = sessionStorage.getItem(KEY_TARGET);
    const last = Number(sessionStorage.getItem(KEY_LAST) || "0");
    const attempts = Number(sessionStorage.getItem(KEY_ATTEMPTS) || "0");
    if (target !== targetBuildId) return true;
    // Normalização de relógio: diferença negativa (retrocesso) ou timestamp
    // implausivelmente antigo/futuro (>24h) → trata como janela expirada.
    const diff = Date.now() - last;
    if (diff < 0 || diff > LOOP_WINDOW_MS) return true;
    return attempts < MAX_ATTEMPTS;
  } catch {
    return true;
  }
}

export function markReloadAttempt(targetBuildId: string) {
  try {
    const prevTarget = sessionStorage.getItem(KEY_TARGET);
    const attempts =
      prevTarget === targetBuildId ? Number(sessionStorage.getItem(KEY_ATTEMPTS) || "0") : 0;
    sessionStorage.setItem(KEY_TARGET, targetBuildId);
    sessionStorage.setItem(KEY_ATTEMPTS, String(attempts + 1));
    sessionStorage.setItem(KEY_LAST, String(Date.now()));
  } catch {
    /* noop */
  }
}

export function clearReloadGuardIfMatching(currentBuildId: string) {
  try {
    const target = sessionStorage.getItem(KEY_TARGET);
    if (target && target === currentBuildId) {
      sessionStorage.removeItem(KEY_TARGET);
      sessionStorage.removeItem(KEY_ATTEMPTS);
      sessionStorage.removeItem(KEY_LAST);
    }
  } catch {
    /* noop */
  }
}

export function loopDetectedFor(targetBuildId: string): boolean {
  try {
    const target = sessionStorage.getItem(KEY_TARGET);
    const attempts = Number(sessionStorage.getItem(KEY_ATTEMPTS) || "0");
    const last = Number(sessionStorage.getItem(KEY_LAST) || "0");
    const diff = Date.now() - last;
    // Se o relógio retrocedeu (diff<0) ou saímos da janela, não bloqueia.
    return (
      target === targetBuildId &&
      attempts >= MAX_ATTEMPTS &&
      diff >= 0 &&
      diff < LOOP_WINDOW_MS
    );
  } catch {
    return false;
  }
}