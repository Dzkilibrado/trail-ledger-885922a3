import { priorityList, type ScheduleStatus } from "@/lib/maintenance-engine";
import type { EventRow, Moto, Schedule, NextMaintenanceSnapshot } from "./types";

export function computeStatuses(
  moto: Pick<Moto, "hours_total" | "km_total" | "hours_initial" | "km_initial">,
  schedules: Schedule[],
  events: EventRow[],
): ScheduleStatus[] {
  return priorityList(schedules, moto, events);
}

function formatRemaining(s: ScheduleStatus): string {
  if (s.status === "overdue") {
    if (s.drivenBy === "hours" && s.remaining.hours != null) return `Vencida há ${Math.abs(s.remaining.hours).toFixed(1)} h`;
    if (s.drivenBy === "km" && s.remaining.km != null) return `Vencida há ${Math.abs(s.remaining.km).toFixed(0)} km`;
    if (s.drivenBy === "days" && s.remaining.days != null) return `Vencida há ${Math.abs(Math.round(s.remaining.days))} dias`;
    return "Vencida";
  }
  if (s.drivenBy === "hours" && s.remaining.hours != null) return `Faltam ${s.remaining.hours.toFixed(1)} h`;
  if (s.drivenBy === "km" && s.remaining.km != null) return `Faltam ${s.remaining.km.toFixed(0)} km`;
  if (s.drivenBy === "days" && s.remaining.days != null) return `Faltam ${Math.round(s.remaining.days)} dias`;
  return "Em dia";
}

/** Próxima manutenção relevante: a mais crítica da fila. */
export function computeNextMaintenance(statuses: ScheduleStatus[]): NextMaintenanceSnapshot | null {
  const next = statuses[0];
  if (!next) return null;
  return {
    scheduleId: next.schedule.id,
    name: next.label,
    remainingLabel: formatRemaining(next),
    status: next.status,
  };
}