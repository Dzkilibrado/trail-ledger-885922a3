import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Motorcycle } from "@/lib/trailbook";

const KEY = "trailbook:active-motorcycle-id";
const EVT = "trailbook:active-motorcycle-changed";

export const motorcycleQueryKeys = {
  all: ["motorcycles", "all"] as const,
  active: ["motorcycles", "active"] as const,
  archivedCount: ["motorcycles", "archived-count"] as const,
};

export type ActiveMotorcycle = Motorcycle;

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveMotorcycleId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* noop */
  }
}

export function clearActiveMotorcycleIfMatches(id: string) {
  if (typeof window === "undefined") return;
  if (read() === id) setStoredActiveMotorcycleId(null);
}

export async function invalidateMotorcycleState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["motorcycles"] }),
    queryClient.invalidateQueries({ queryKey: ["motorcycle"] }),
    queryClient.invalidateQueries({ queryKey: ["sidebar", "active-moto"] }),
    queryClient.invalidateQueries({ queryKey: ["document-pendencies"] }),
    queryClient.invalidateQueries({ queryKey: ["docs-hub"] }),
    queryClient.invalidateQueries({ queryKey: ["events"] }),
    queryClient.invalidateQueries({ queryKey: ["schedules"] }),
    queryClient.invalidateQueries({ queryKey: ["attachments"] }),
    queryClient.invalidateQueries({ queryKey: ["workshops"] }),
    queryClient.invalidateQueries({ queryKey: ["tickets"] }),
    queryClient.invalidateQueries({ queryKey: ["transfers"] }),
  ]);
}

export function useActiveMotorcycles() {
  return useQuery({
    queryKey: motorcycleQueryKeys.active,
    queryFn: async (): Promise<ActiveMotorcycle[]> => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("motorcycles")
        .select("*")
        .eq("owner_id", uid)
        .eq("status" as never, "active" as never)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ActiveMotorcycle[];
    },
  });
}

export function useAllMyMotorcycles() {
  return useQuery({
    queryKey: motorcycleQueryKeys.all,
    queryFn: async (): Promise<ActiveMotorcycle[]> => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("motorcycles")
        .select("*")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ActiveMotorcycle[];
    },
  });
}

export function useArchivedMotorcyclesCount() {
  return useQuery({
    queryKey: motorcycleQueryKeys.archivedCount,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return 0;
      const { count, error } = await supabase
        .from("motorcycles")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid)
        .eq("status" as never, "archived" as never);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function useStoredActiveMotorcycleId() {
  const [storedId, setStoredId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setStoredId(read());
    sync();
    setHydrated(true);
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { storedId, hydrated };
}

/**
 * Contexto oficial da moto ativa.
 * Fonte confiável: lista de motos ativas no banco + preferência local validada.
 * O localStorage é apenas preferência; se apontar para moto arquivada/inexistente,
 * é limpo automaticamente e o contexto cai para outra ativa ou null.
 */
export function useActiveMotorcycle() {
  const activeMotos = useActiveMotorcycles();
  const { storedId, hydrated } = useStoredActiveMotorcycleId();

  const motos = activeMotos.data ?? [];
  const activeMoto = useMemo(() => {
    if (motos.length === 0) return null;
    return motos.find((m) => m.id === storedId) ?? motos[0];
  }, [motos, storedId]);
  const activeId = activeMoto?.id ?? null;

  useEffect(() => {
    if (!hydrated || !activeMotos.isSuccess || activeMotos.isFetching) return;
    if (!activeId) {
      if (storedId) setStoredActiveMotorcycleId(null);
      return;
    }
    if (storedId !== activeId) setStoredActiveMotorcycleId(activeId);
  }, [hydrated, activeMotos.isSuccess, activeMotos.isFetching, activeId, storedId]);

  const setActiveId = useCallback((id: string | null) => {
    if (!id) {
      setStoredActiveMotorcycleId(null);
      return;
    }
    if (!activeMotos.isSuccess) {
      setStoredActiveMotorcycleId(id);
      return;
    }
    const existsAndActive = motos.some((m) => m.id === id);
    setStoredActiveMotorcycleId(existsAndActive ? id : null);
  }, [activeMotos.isSuccess, motos]);

  return {
    activeId,
    activeMoto,
    activeMotos: motos,
    isLoading: activeMotos.isLoading,
    isFetching: activeMotos.isFetching,
    setActiveId,
  };
}