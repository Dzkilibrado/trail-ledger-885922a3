import { supabase } from "@/integrations/supabase/client";

/**
 * Recomposição cronológica exata da linha do tempo da moto.
 *
 * A cada criação/edição/exclusão de atividade, o TrailBook reprocessa
 * TODOS os eventos da moto em ordem cronológica (occurred_at ASC,
 * empatando por created_at) e reescreve `hours_at_event` / `km_at_event`
 * como soma acumulada dos deltas até aquele ponto. Depois atualiza
 * `hours_total` / `km_total` da moto e recomputa `last_done_*` de cada
 * programação a partir do evento vinculado mais recente na nova timeline.
 *
 * Isso elimina o "best-effort" antigo que carimbava eventos históricos
 * com os totais atuais e gerava inconsistência ao editar uma atividade
 * do meio da linha do tempo.
 */

export async function recomposeTimeline(motoId: string): Promise<{ hours: number; km: number }> {
  // Baseline preservada (informada no cadastro / backfill).
  // Sem essa leitura, a recomposição zeraria o horímetro de motos usadas
  // que já foram cadastradas com valor inicial > 0 (bug crítico corrigido).
  const { data: moto } = await supabase
    .from("motorcycles")
    .select("hours_initial, km_initial")
    .eq("id", motoId)
    .single();
  const h0 = Number((moto as any)?.hours_initial) || 0;
  const k0 = Number((moto as any)?.km_initial) || 0;

  const { data: evs } = await supabase
    .from("events")
    .select("id, occurred_at, created_at, hours_delta, km_delta")
    .eq("motorcycle_id", motoId)
    .order("occurred_at", { ascending: true })
    .order("created_at", { ascending: true });

  let hours = h0;
  let km = k0;
  for (const e of evs ?? []) {
    hours += Number((e as any).hours_delta) || 0;
    km += Number((e as any).km_delta) || 0;
    // Grava snapshot cronológico exato deste evento
    await supabase
      .from("events")
      .update({ hours_at_event: hours, km_at_event: km } as never)
      .eq("id", (e as any).id);
  }
  // Escrita autorizada via RPC (respeita baseline e libera a trava
  // BEFORE UPDATE que bloqueia regressões silenciosas de horímetro/KM).
  await supabase.rpc("apply_recomposed_totals" as never, {
    _moto: motoId, _hours: hours, _km: km,
  } as never);

  // Recomputa cada schedule a partir do histórico já normalizado.
  const { data: schs } = await supabase
    .from("maintenance_schedules")
    .select("id")
    .eq("motorcycle_id", motoId);
  for (const s of schs ?? []) {
    await recalcScheduleFromHistory((s as any).id);
  }
  return { hours, km };
}

export async function recalcTotals(motoId: string): Promise<{ hours: number; km: number }> {
  const { data: moto } = await supabase
    .from("motorcycles")
    .select("hours_initial, km_initial")
    .eq("id", motoId)
    .single();
  const h0 = Number((moto as any)?.hours_initial) || 0;
  const k0 = Number((moto as any)?.km_initial) || 0;
  const { data: evs } = await supabase
    .from("events")
    .select("hours_delta, km_delta")
    .eq("motorcycle_id", motoId);
  const hours = h0 + (evs ?? []).reduce((s, e) => s + (Number((e as any).hours_delta) || 0), 0);
  const km    = k0 + (evs ?? []).reduce((s, e) => s + (Number((e as any).km_delta) || 0), 0);
  await supabase.rpc("apply_recomposed_totals" as never, {
    _moto: motoId, _hours: hours, _km: km,
  } as never);
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
  // Compat: agora sempre delega para a recomposição cronológica completa.
  await recomposeTimeline(motoId);
}

/** Converte horas+minutos em decimal (1h 30min → 1.5). */
export function toDecimalHours(hours: number, minutes: number): number {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return Math.round((h + m / 60) * 100) / 100;
}