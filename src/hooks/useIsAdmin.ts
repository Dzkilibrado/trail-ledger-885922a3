import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSyncExternalStore } from "react";
import { isViewingAsUser, subscribeViewAsUser } from "@/hooks/useViewAsUser";

export function useIsAdmin() {
  const q = useQuery({
    queryKey: ["me", "is-admin"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.user) return false;
      const { data, error } = await supabase.rpc("is_user_admin" as any, {
        _user_id: s.session.user.id,
      });
      if (error) throw error;
      return data === true;
    },
    staleTime: 60_000,
  });
  const viewingAsUser = useSyncExternalStore(
    subscribeViewAsUser,
    () => isViewingAsUser(),
    () => false,
  );
  const realIsAdmin = !!q.data;
  return {
    isAdmin: realIsAdmin && !viewingAsUser,
    realIsAdmin,
    viewingAsUser,
    loading: q.isLoading,
  };
}
