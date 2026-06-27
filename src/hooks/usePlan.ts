import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { planOf, type PlanDef } from "@/lib/plans";

export function usePlan(): { plan: PlanDef; loading: boolean } {
  const q = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("plan, plan_since").eq("id", u.user.id).maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
  return { plan: planOf(q.data ?? null), loading: q.isLoading };
}