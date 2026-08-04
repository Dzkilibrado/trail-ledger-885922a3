import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveHomeShortcuts } from "@/lib/home-shortcuts";

export const HOME_SHORTCUTS_QUERY_KEY = ["home-shortcuts"] as const;

async function fetchHomeShortcutKeys(): Promise<string[] | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("profiles")
    .select("home_shortcuts")
    .eq("id", uid)
    .maybeSingle();
  return data?.home_shortcuts ?? null;
}

/** Atalhos personalizados do usuário para a tela inicial, já resolvidos com ícone/rota. */
export function useHomeShortcuts() {
  const q = useQuery({
    queryKey: HOME_SHORTCUTS_QUERY_KEY,
    queryFn: fetchHomeShortcutKeys,
    staleTime: 30_000,
  });
  return {
    keys: q.data ?? null,
    shortcuts: resolveHomeShortcuts(q.data),
    isLoading: q.isLoading,
  };
}
