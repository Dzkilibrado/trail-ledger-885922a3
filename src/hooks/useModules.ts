import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlatformModule, ModuleStatus } from "@/lib/modules";

export function useModules() {
  return useQuery({
    queryKey: ["platform-modules"],
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