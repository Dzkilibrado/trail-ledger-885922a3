import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "trailbook.view-as-user";
const STARTED_AT_KEY = "trailbook.view-as-user.started-at";
const EVENT = "trailbook:view-as-user-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useViewAsUser() {
  const [active, setActive] = useState<boolean>(() => read());

  useEffect(() => {
    const sync = () => setActive(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const enter = useCallback(async () => {
    try {
      const startedAt = new Date().toISOString();
      window.sessionStorage.setItem(STORAGE_KEY, "1");
      window.sessionStorage.setItem(STARTED_AT_KEY, startedAt);
      window.dispatchEvent(new Event(EVENT));
      await supabase.rpc("admin_log_view_as_user" as any, {
        _action: "view_as_user_enter",
        _metadata: { started_at: startedAt },
      });
    } catch {
      // audit best-effort — UI state already updated
    }
  }, []);

  const exit = useCallback(async () => {
    try {
      const startedAt = window.sessionStorage.getItem(STARTED_AT_KEY);
      const endedAt = new Date().toISOString();
      const durationSec = startedAt
        ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000))
        : null;
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(STARTED_AT_KEY);
      window.dispatchEvent(new Event(EVENT));
      await supabase.rpc("admin_log_view_as_user" as any, {
        _action: "view_as_user_exit",
        _metadata: { started_at: startedAt, ended_at: endedAt, duration_seconds: durationSec },
      });
    } catch {
      // best-effort
    }
  }, []);

  return { active, enter, exit };
}

/** Sync read used by other hooks (e.g. useIsAdmin) to mask admin privileges in UI. */
export function isViewingAsUser(): boolean {
  return read();
}

export function subscribeViewAsUser(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}