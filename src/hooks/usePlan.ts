import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { planOf, type PlanDef } from "@/lib/plans";

export function usePlan(): { plan: PlanDef; loading: boolean } {
  const q = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("plan, plan_since")
        .eq("id", s.session.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
  return { plan: planOf(q.data ?? null), loading: q.isLoading };
}
