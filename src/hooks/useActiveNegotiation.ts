import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveNegotiation = {
  id: string;
  code: string;
  status: string;
  version: number;
  buyer_name: string | null;
  amount: number | null;
  created_at: string;
  has_signed_document: boolean;
  seller_accepted: boolean;
  buyer_accepted: boolean;
};

/** Recibo em rascunho mais recente da moto (para card na Central). */
export function useActiveNegotiation(motoId: string | undefined) {
  return useQuery({
    enabled: !!motoId,
    queryKey: ["active-negotiation", motoId],
    queryFn: async (): Promise<ActiveNegotiation | null> => {
      const { data, error } = await supabase.rpc(
        "get_active_negotiation" as never,
        { _moto_id: motoId } as never,
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as ActiveNegotiation | null;
    },
    staleTime: 30_000,
  });
}

/** Lista todos os recibos da moto (para card de contagem no Passaporte). */
export function useReceiptsForMoto(motoId: string | undefined) {
  return useQuery({
    enabled: !!motoId,
    queryKey: ["smart-receipts", motoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smart_receipts" as never)
        .select("id, code, version, status, issued_at, buyer_snapshot, negotiation")
        .eq("motorcycle_id", motoId!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        code: string;
        version: number;
        status: string;
        issued_at: string | null;
        buyer_snapshot: { full_name?: string } | null;
        negotiation: { amount?: number; date?: string } | null;
      }>;
    },
    staleTime: 30_000,
  });
}