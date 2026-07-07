import { supabase } from "@/integrations/supabase/client";

/**
 * Recalcula estados dependentes após uma atividade ser editada/excluída.
 *
 * - `totalsFromEvents(motoId)` refaz `hours_total` / `km_total` da moto
 *   somando todos os deltas remanescentes.
 * - `recalcScheduleFromHistory(scheduleId)` reconstroi `last_done_*`
 *   do schedule a partir do último `maintenance_item` que o referencia.
 *   Se não houver mais nenhum, zera os campos (o schedule volta a aguardar
 *   a primeira execução).
 * - `recalcAllForMotorcycle(motoId)` faz ambos em sequência para todos os
 *   schedules da moto — usado após excluir/editar atividade.
 */

export async function recalcTotals(motoId: string): Promise<{ hours: number; km: number }> {
  const { data: evs } = await supabase
    .from("events")
    .select("hours_delta, km_delta")
    .eq("motorcycle_id", motoId);
  const hours = (evs ?? []).reduce((s, e) => s + (Number((e as any).hours_delta) || 0), 0);
  const km = (evs ?? []).reduce((s, e) => s + (Number((e as any).km_delta) || 0), 0);
  await supabase.from("motorcycles").update({ hours_total: hours, km_total: km } as never).eq("id", motoId);
  return { hours, km };
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
  await recalcTotals(motoId);
  const { data: schs } = await supabase
    .from("maintenance_schedules")
    .select("id")
    .eq("motorcycle_id", motoId);
  for (const s of schs ?? []) {
    await recalcScheduleFromHistory((s as any).id);
  }
}

/** Converte horas+minutos em decimal (1h 30min → 1.5). */
export function toDecimalHours(hours: number, minutes: number): number {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return Math.round((h + m / 60) * 100) / 100;
}