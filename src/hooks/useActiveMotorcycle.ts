import { useEffect, useState, useCallback } from "react";

const KEY = "trailbook:active-motorcycle-id";
const EVT = "trailbook:active-motorcycle-changed";

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Guarda a moto ativa do usuário no localStorage.
 * SSR-safe: leitura acontece em useEffect para evitar hydration mismatch.
 */
export function useActiveMotorcycle() {
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    setActiveIdState(read());
    const handler = () => setActiveIdState(read());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
      window.dispatchEvent(new Event(EVT));
    } catch {
      /* noop */
    }
  }, []);

  return { activeId, setActiveId };
}