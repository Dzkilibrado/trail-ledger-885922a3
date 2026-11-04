/**
 * useVersionReporter
 *
 * Registra silenciosamente a versão do frontend no perfil do usuário autenticado.
 * - Executado uma vez por sessão, logo após o login.
 * - Fire-and-forget: erros são ignorados para não impactar a experiência.
 * - Requer que as colunas app_version, app_build_id e app_last_seen_at
 *   já existam na tabela profiles (migration 20261104000000_profiles_version_tracking.sql).
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, BUILD_ID } from "@/lib/version/build-info";

export function useVersionReporter(userId: string | null | undefined) {
  const reported = useRef(false);

  useEffect(() => {
    if (!userId || reported.current) return;
    reported.current = true;

    // Fire-and-forget: não aguarda resolução nem trata erro de forma visível
    supabase
      .from("profiles")
      .update({
        app_version: APP_VERSION,
        app_build_id: BUILD_ID,
        app_last_seen_at: new Date().toISOString(),
      } as any)
      .eq("id", userId)
      .then(() => {
        // silencioso — erros não impactam o usuário
      });
  }, [userId]);
}
