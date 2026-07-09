import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OriginType, ExpectedDocKind } from "@/lib/motorcycle-origin";

export type PendencyRow = {
  motorcycle_id: string;
  owner_id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  year_model: number | null;
  origin_type: OriginType | null;
  has_origin_pendency: boolean;
  expected_kind: ExpectedDocKind;
};

/**
 * Lista as pendências documentais do usuário logado (Módulo Propriedade
 * & Documentação). Usa a view `document_pendencies_view` (security_invoker),
 * portanto RLS de motorcycles se aplica automaticamente.
 */
export function useDocumentPendencies() {
  return useQuery({
    queryKey: ["document-pendencies"],
    queryFn: async (): Promise<PendencyRow[]> => {
      const { data, error } = await supabase
        .from("document_pendencies_view")
        .select("*")
        .eq("has_origin_pendency", true);
      if (error) throw error;
      return (data ?? []) as unknown as PendencyRow[];
    },
    staleTime: 30_000,
  });
}

/** Pendência de uma moto específica (para banners na Central da Moto). */
export function useMotoDocumentPendency(motoId: string | undefined) {
  return useQuery({
    enabled: !!motoId,
    queryKey: ["document-pendencies", motoId],
    queryFn: async (): Promise<PendencyRow | null> => {
      const { data, error } = await supabase
        .from("document_pendencies_view")
        .select("*")
        .eq("motorcycle_id", motoId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PendencyRow | null;
    },
    staleTime: 30_000,
  });
}