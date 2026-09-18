// ============================================================
// Assistant Permissions — constantes e hook de verificação
// has_permission() no banco não recebe uid — usa auth.uid() internamente
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ASSISTANT_PERMISSIONS = {
  VIEW_ADMIN:          "assistant.view_admin",
  MANAGE_CONTENT:      "assistant.manage_content",
  MANAGE_INTENTS:      "assistant.manage_intents",
  VIEW_UNANSWERED:     "assistant.view_unanswered",
  RESOLVE_UNANSWERED:  "assistant.resolve_unanswered",
  HANDLE_SUPPORT:      "assistant.handle_support",
  VIEW_METRICS:        "assistant.view_metrics",
} as const;

export type AssistantPermission = typeof ASSISTANT_PERMISSIONS[keyof typeof ASSISTANT_PERMISSIONS];

/** Verifica se o usuário autenticado tem a permission via RPC has_permission() */
export function useHasPermission(key: AssistantPermission) {
  return useQuery({
    queryKey: ["has_permission", key],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("has_permission", { _key: key });
      if (error) return false;
      return data as boolean;
    },
    staleTime: 60_000,
  });
}
