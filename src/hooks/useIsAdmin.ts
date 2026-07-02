import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const q = useQuery({
    queryKey: ["me", "is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role === "admin";
    },
    staleTime: 60_000,
  });
  return { isAdmin: !!q.data, loading: q.isLoading };
}