import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlatformModule, ModuleStatus } from "@/lib/modules";

const MODULES_QUERY_KEY = ["platform-modules"];

// A tela usa vários componentes que chamam useModules() ao mesmo tempo
// (menu lateral + ModuleGate da página). Mantemos uma única conexão
// realtime compartilhada entre eles, em vez de uma por componente.
let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
let subscriberCount = 0;

function subscribeToModuleChanges(qc: QueryClient) {
  subscriberCount++;
  if (!sharedChannel) {
    sharedChannel = supabase
      .channel("platform-modules-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_modules" }, () =>
        qc.invalidateQueries({ queryKey: MODULES_QUERY_KEY }),
      )
      .subscribe();
  }
  return () => {
    subscriberCount--;
    if (subscriberCount <= 0 && sharedChannel) {
      supabase.removeChannel(sharedChannel);
      sharedChannel = null;
      subscriberCount = 0;
    }
  };
}

export function useModules() {
  const qc = useQueryClient();

  // Reage em tempo real a qualquer mudança de status feita pelo admin,
  // pra usuários já logados verem o aviso de manutenção/desabilitado
  // na hora, sem precisar sair e entrar de novo na conta.
  useEffect(() => subscribeToModuleChanges(qc), [qc]);

  return useQuery({
    queryKey: MODULES_QUERY_KEY,
    queryFn: async (): Promise<PlatformModule[]> => {
      const { data, error } = await supabase.rpc("get_platform_modules" as any);
      if (error) throw error;
      return (data ?? []) as PlatformModule[];
    },
    staleTime: 60_000,
  });
}

export function useModule(key: string) {
  const q = useModules();
  const mod = q.data?.find((m) => m.key === key);
  return { module: mod, status: (mod?.status ?? "active") as ModuleStatus, loading: q.isLoading };
}
