/**
 * useForceLogoutGuard
 *
 * Verifica ao iniciar se o admin forçou logout deste usuário.
 * Lógica: se profile.force_logout_at > session.created_at → sign out silencioso.
 *
 * Requer a coluna force_logout_at na tabela profiles
 * (migration 20261104000000_profiles_version_tracking.sql).
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useForceLogoutGuard(userId: string | null | undefined) {
  const checked = useRef(false);

  useEffect(() => {
    if (!userId || checked.current) return;
    checked.current = true;

    async function check() {
      try {
        // Pega a sessão atual para saber quando foi criada
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session) return;

        // Lê apenas o campo force_logout_at do perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("force_logout_at")
          .eq("id", userId!)
          .maybeSingle();

        if (!profile?.force_logout_at) return;

        const forceLogoutAt = new Date(profile.force_logout_at as string).getTime();
        // issued_at é unix timestamp (segundos); convertemos para ms
        const sessionCreatedAt = (session.user.created_at
          ? new Date(session.user.created_at).getTime()
          : 0);
        // Também verificamos o access_token iat se disponível
        // O session.expires_at e .created_at às vezes apontam para criação do usuário,
        // não da sessão. Usamos issued_at do JWT quando disponível.
        const iat: number | undefined = (session as any).user?.app_metadata?.iat;
        const sessionIssuedAt = iat ? iat * 1000 : sessionCreatedAt;

        if (forceLogoutAt > sessionIssuedAt) {
          // Logout silencioso — o usuário vai para a tela de login
          await supabase.auth.signOut();
        }
      } catch {
        // Silencioso — guard não pode bloquear o app
      }
    }

    check();
  }, [userId]);
}
