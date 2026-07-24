import { useEffect, useSyncExternalStore } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { checkForUpdate, getVersionState, subscribeVersion } from "./service";
import { onBroadcast, broadcast } from "./channel";
import { LOCAL_BUILD, BUILD_ID } from "./build-info";
import { clearReloadGuardIfMatching } from "./service";

const POLL_MS = 15 * 60_000;
const ROUTE_CHECK_MS = 60_000;

let lastRouteCheckAt = 0;
let lastUserActivityAt = Date.now();

function bumpActivity() {
  lastUserActivityAt = Date.now();
}

/** Momento em que o usuário fica "inativo o bastante" para auto-reload. */
export function isUserInactive(ms = 60_000): boolean {
  return Date.now() - lastUserActivityAt > ms;
}

export function useVersionState() {
  return useSyncExternalStore(subscribeVersion, getVersionState, getVersionState);
}

export function useVersionWatcher(_queryClient: QueryClient) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Boot: limpa guard se a build atual corresponde ao destino previamente pretendido.
  useEffect(() => {
    clearReloadGuardIfMatching(LOCAL_BUILD.buildId);
    void checkForUpdate({ force: true });
  }, []);

  // Eventos de foco / online / atividade / broadcast.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    const onOnline = () => void checkForUpdate({ force: true });
    const onFocus = () => void checkForUpdate();
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);

    const activityEvents = ["pointerdown", "keydown", "touchstart", "input"] as const;
    activityEvents.forEach((e) => window.addEventListener(e, bumpActivity, { passive: true }));

    const off = onBroadcast((msg) => {
      if (msg.kind === "update_available" && msg.buildId !== BUILD_ID) {
        void checkForUpdate({ force: true });
      }
    });

    return () => {
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      activityEvents.forEach((e) => window.removeEventListener(e, bumpActivity));
      off();
    };
  }, []);

  // Polling leve enquanto visível/online.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      void checkForUpdate();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  // Mudança de rota (com throttle).
  useEffect(() => {
    const now = Date.now();
    if (now - lastRouteCheckAt < ROUTE_CHECK_MS) return;
    lastRouteCheckAt = now;
    void checkForUpdate();
  }, [pathname]);

  // Anuncia para outras abas sempre que detectamos atualização.
  const state = useVersionState();
  useEffect(() => {
    if (state.updateAvailable && state.remote) {
      broadcast({ kind: "update_available", buildId: state.remote.buildId });
    }
  }, [state.updateAvailable, state.remote]);
}