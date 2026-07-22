import { supabase } from "@/integrations/supabase/client";

/**
 * Recomposição cronológica exata da linha do tempo da moto.
 *
 * v1.7 (auditoria integridade): agora delega para a RPC atômica
 * `recompose_timeline_server`, que executa toda a recomposição em UMA
 * transação protegida por advisory lock por moto. Isso elimina:
 *  - N chamadas do cliente sem transação (janela de inconsistência);
 *  - lost update quando duas abas/dispositivos recompõem em paralelo;
 *  - snapshots `hours_at_event`/`km_at_event` divergindo entre eventos.
 */

export async function recomposeTimeline(motoId: string): Promise<{ hours: number; km: number }> {
  const { data, error } = await supabase.rpc(
    "recompose_timeline_server" as never,
    { _moto: motoId } as never,
  );
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
  // Não usamos `|| 0` no path de leitura: se o RPC não retornar linha,
  // é um erro de integridade que precisa aparecer, não ser mascarado.
  if (!row) throw new Error("Recomposição não retornou totais");
  return { hours: Number(row.hours_total), km: Number(row.km_total) };
}

export async function recalcTotals(motoId: string): Promise<{ hours: number; km: number }> {
  // Compat: mesma implementação servidor-side.
  return recomposeTimeline(motoId);
}

export async function recalcScheduleFromHistory(scheduleId: string) {
  // pega o item de manutenção mais recente que referencia este schedule
  const { data: items } = await supabase
    .from("maintenance_items")
    .select("event_id")
    .eq("schedule_id", scheduleId);
  const evIds = (items ?? []).map((i: any) => i.event_id);
  if (evIds.length === 0) {
    await supabase
      .from("maintenance_schedules")
      .update({
        last_done_at: null,
        last_done_hours: null,
        last_done_km: null,
        last_completed_event_id: null,
      } as never)
      .eq("id", scheduleId);
    return;
  }
  const { data: ev } = await supabase
    .from("events")
    .select("id, occurred_at, hours_at_event, km_at_event")
    .in("id", evIds)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ev) return;
  await supabase
    .from("maintenance_schedules")
    .update({
      last_done_at: (ev as any).occurred_at,
      last_done_hours: (ev as any).hours_at_event,
      last_done_km: (ev as any).km_at_event,
      last_completed_event_id: (ev as any).id,
    } as never)
    .eq("id", scheduleId);
}

export async function recalcAllForMotorcycle(motoId: string) {
  // Compat: agora sempre delega para a recomposição cronológica completa.
  await recomposeTimeline(motoId);
}

/** Converte horas+minutos em decimal (1h 30min → 1.5). */
export function toDecimalHours(hours: number, minutes: number): number {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return Math.round((h + m / 60) * 100) / 100;
}