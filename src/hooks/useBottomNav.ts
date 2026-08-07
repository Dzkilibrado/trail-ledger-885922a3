import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveBottomNav } from "@/lib/bottom-nav";

export const BOTTOM_NAV_QUERY_KEY = ["bottom-nav-items"] as const;

async function fetchBottomNavKeys(): Promise<string[] | null> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("profiles")
    .select("bottom_nav_items")
    .eq("id", uid)
    .maybeSingle();
  return (data as { bottom_nav_items: string[] | null } | null)?.bottom_nav_items ?? null;
}

/** Itens personalizados da barra de navegação inferior, já resolvidos com ícone/rota. */
export function useBottomNav() {
  const q = useQuery({
    queryKey: BOTTOM_NAV_QUERY_KEY,
    queryFn: fetchBottomNavKeys,
    staleTime: 30_000,
  });
  return {
    keys: q.data ?? null,
    items: resolveBottomNav(q.data),
    isLoading: q.isLoading,
  };
}
