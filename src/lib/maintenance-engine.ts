import type { Database } from "@/integrations/supabase/types";
import type { MaintenanceCategory } from "./trailbook";
import { MAINTENANCE_PRESETS, SEVERITY_WEIGHT, type Severity } from "./maintenance-presets";

type Schedule = Database["public"]["Tables"]["maintenance_schedules"]["Row"];
type Moto = Database["public"]["Tables"]["motorcycles"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type DueStatus = "ok" | "soon" | "due" | "overdue";

export interface ScheduleStatus {
  schedule: Schedule;
  preset?: typeof MAINTENANCE_PRESETS[number];
  severity: Severity;
  /** Progresso 0..1+ — >1 = vencido. */
  progress: number;
  status: DueStatus;
  /** Restante até o vencimento (negativo = atrasado). */
  remaining: {
    hours: number | null;
    km: number | null;
    days: number | null;
  };
  /** Em qual dimensão vai vencer primeiro. */
  drivenBy: "hours" | "km" | "days" | "unknown";
  /** Data estimada de vencimento (baseada em uso recente ou intervalo de dias). */
  estimatedDueDate: Date | null;
  label: string;
  category: MaintenanceCategory;
}

/**
 * Calcula taxa média de uso da motocicleta (horas/dia, km/dia)
 * com base nos últimos `windowDays` dias de eventos.
 */
export function usageRate(events: Pick<EventRow, "occurred_at" | "hours_delta" | "km_delta">[], windowDays = 90) {
  const since = Date.now() - windowDays * 86400000;
  let h = 0, k = 0, span = 0;
  let earliest = Date.now();
  for (const e of events) {
    const t = new Date(e.occurred_at).getTime();
    if (t < since) continue;
    h += Number(e.hours_delta) || 0;
    k += Number(e.km_delta) || 0;
    if (t < earliest) earliest = t;
  }
  span = Math.max(1, (Date.now() - earliest) / 86400000);
  return {
    hoursPerDay: h / span,
    kmPerDay: k / span,
    spanDays: span,
  };
}

function statusFromProgress(p: number): DueStatus {
  if (p >= 1) return "overdue";
  if (p >= 0.9) return "due";
  if (p >= 0.75) return "soon";
  return "ok";
}

/** Calcula o status de UMA programação contra o estado atual da moto. */
export function evaluateSchedule(
  schedule: Schedule,
  moto: Pick<Moto, "hours_total" | "km_total" | "hours_initial" | "km_initial" | "initial_review_done_at" | "created_at">,
  rate: { hoursPerDay: number; kmPerDay: number },
): ScheduleStatus {
  const preset = MAINTENANCE_PRESETS.find((p) => p.name === schedule.name);
  const severity: Severity = preset?.severity ?? "medium";

  // Separação semântica explícita (evita interpretar plano/criação como manutenção):
  //   1) baseline de uso da moto      → hours_initial / km_initial
  //   2) início do acompanhamento     → motorcycles.initial_review_done_at ?? motorcycles.created_at
  //   3) manutenção efetivamente feita → schedule.last_done_* (única fonte legítima)
  //   4) criação técnica do schedule  → schedule.created_at (NUNCA usado como proxy de manutenção)
  //
  // Para o eixo de dias, o fallback é o "início do acompanhamento" — e SÓ se
  // o schedule já existia naquele momento. Um componente adicionado depois
  // (novo item de catálogo, item customizado) não pode herdar uma data de
  // manutenção fictícia; enquanto não houver last_done_at explícito, o eixo
  // de dias é ignorado para aquele schedule.
  const initialH = Number((moto as any).hours_initial ?? 0);
  const initialK = Number((moto as any).km_initial ?? 0);
  const lastH = schedule.last_done_hours != null ? Number(schedule.last_done_hours) : initialH;
  const lastK = schedule.last_done_km != null ? Number(schedule.last_done_km) : initialK;

  let lastAt: number | null = schedule.last_done_at ? new Date(schedule.last_done_at).getTime() : null;
  if (lastAt == null && schedule.interval_days) {
    const trackingStartIso = (moto as any).initial_review_done_at ?? (moto as any).created_at ?? null;
    const scheduleCreatedIso = (schedule as any).created_at ?? null;
    if (trackingStartIso && scheduleCreatedIso) {
      const trackingStart = new Date(trackingStartIso).getTime();
      const scheduleCreated = new Date(scheduleCreatedIso).getTime();
      // O schedule só herda o início do acompanhamento se já existia naquele
      // momento. Tolerância de 60s cobre criação em lote junto com a moto.
      if (scheduleCreated <= trackingStart + 60_000) {
        lastAt = trackingStart;
      }
    }
  }

  const usedH = schedule.interval_hours ? Number(moto.hours_total) - lastH : null;
  const usedK = schedule.interval_km ? Number(moto.km_total) - lastK : null;
  const usedD = schedule.interval_days && lastAt ? (Date.now() - lastAt) / 86400000 : null;

  const progH = schedule.interval_hours && usedH != null ? usedH / schedule.interval_hours : -Infinity;
  const progK = schedule.interval_km && usedK != null ? usedK / schedule.interval_km : -Infinity;
  const progD = schedule.interval_days && usedD != null ? usedD / schedule.interval_days : -Infinity;

  const progress = Math.max(progH, progK, progD, 0);
  const drivenBy = progress === progH ? "hours" : progress === progK ? "km" : progress === progD ? "days" : "unknown";

  const remaining = {
    hours: schedule.interval_hours ? schedule.interval_hours - (usedH ?? 0) : null,
    km: schedule.interval_km ? schedule.interval_km - (usedK ?? 0) : null,
    days: schedule.interval_days ? schedule.interval_days - (usedD ?? 0) : null,
  };

  // Estimativa de vencimento: pega a menor data prevista entre horas/km/dias.
  const candidates: number[] = [];
  if (remaining.hours != null && rate.hoursPerDay > 0) candidates.push(Date.now() + (remaining.hours / rate.hoursPerDay) * 86400000);
  if (remaining.km != null && rate.kmPerDay > 0)       candidates.push(Date.now() + (remaining.km / rate.kmPerDay) * 86400000);
  if (remaining.days != null)                          candidates.push(Date.now() + remaining.days * 86400000);
  const estimatedDueDate = candidates.length ? new Date(Math.min(...candidates)) : null;

  return {
    schedule,
    preset,
    severity,
    progress,
    status: statusFromProgress(progress),
    remaining,
    drivenBy,
    estimatedDueDate,
    label: schedule.name,
    category: schedule.category,
  };
}

/** Lista priorizada de todas as programações (mais críticas + mais vencidas primeiro). */
export function priorityList(
  schedules: Schedule[],
  moto: Pick<Moto, "hours_total" | "km_total" | "hours_initial" | "km_initial" | "initial_review_done_at" | "created_at">,
  events: Pick<EventRow, "occurred_at" | "hours_delta" | "km_delta">[],
): ScheduleStatus[] {
  const rate = usageRate(events);
  const now = Date.now();
  return schedules
    .filter((s) => {
      if (!s.active) return false;
      const st = (s as any).status as string | undefined;
      if (st === "ignored") return false;
      if (st === "snoozed") {
        const until = (s as any).snoozed_until as string | null | undefined;
        if (until && new Date(until).getTime() > now) return false;
      }
      return true;
    })
    .map((s) => evaluateSchedule(s, moto, rate))
    .sort((a, b) => {
      // Ordena por: vencidos > severidade > progresso descrescente
      const sa = SEVERITY_WEIGHT[a.severity];
      const sb = SEVERITY_WEIGHT[b.severity];
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      if (sa !== sb) return sb - sa;
      return b.progress - a.progress;
    });
}