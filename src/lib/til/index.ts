import { computeHealth } from "./health";
import { computeStatuses, computeNextMaintenance } from "./schedule";
import { computeStats } from "./usage";
import { computeNextAlert } from "./alerts";
import { computeNextAction } from "./suggestions";
import { computeComponentViews, type ComponentInspection } from "./components";
import { computeActionPlan, summarizeActionPlan } from "./action-plan";
import { computeRideAnswer } from "./ride-answer";
import { computeGreeting } from "./greeting";
import type {
  Attachment,
  CockpitSnapshot,
  EventRow,
  Moto,
  Schedule,
} from "./types";

export * from "./types";
export * from "./components";
export * from "./status";
export * from "./diagnosis";
export * from "./action-plan";
export * from "./messages";
export * from "./confidence";
export * from "./recommendations";
export * from "./ride-answer";

/**
 * Fachada oficial da TrailBook Intelligence Layer.
 * Toda a experiência do Cockpit consulta APENAS esta função.
 * Componentes NUNCA calculam — só leem o snapshot retornado aqui.
 */
export function computeCockpitSnapshot(input: {
  moto: Moto;
  events: EventRow[];
  schedules: Schedule[];
  attachments: Attachment[];
  isOwner: boolean;
  maintenanceItems?: Array<{ event_id: string; schedule_id: string | null; created_at: string }>;
  inspections?: Array<{ schedule_id: string | null; created_at: string; decision: string; notes: string | null }>;
}): CockpitSnapshot {
  const { moto, events, schedules, attachments, isOwner, maintenanceItems, inspections } = input;
  const workshopEventIds = new Set(events.filter((e) => e.workshop_id).map((e) => e.id));
  const statuses = computeStatuses(moto, schedules, events);
  const nextMaintenance = computeNextMaintenance(statuses);
  const stats = computeStats(moto, events);
  const nextAlert = computeNextAlert(statuses);
  const nextAction = computeNextAction({ moto, statuses, events, isOwner });

  const itemsByScheduleId: Record<string, { event_id: string; created_at: string }[]> = {};
  for (const it of maintenanceItems ?? []) {
    if (!it.schedule_id) continue;
    (itemsByScheduleId[it.schedule_id] ||= []).push({ event_id: it.event_id, created_at: it.created_at });
  }
  const inspectionsByScheduleId: Record<string, ComponentInspection[]> = {};
  for (const insp of inspections ?? []) {
    if (!insp.schedule_id) continue;
    (inspectionsByScheduleId[insp.schedule_id] ||= []).push({
      at: insp.created_at,
      decision: insp.decision,
      notes: insp.notes,
    });
  }

  // Sinais de evidência por componente (oficina / foto) — alimentam a confiabilidade.
  const workshopScheduleIds = new Set<string>();
  const photoScheduleIds = new Set<string>();
  const attachmentEventIds = new Set(attachments.map((a) => a.event_id));
  for (const it of maintenanceItems ?? []) {
    if (!it.schedule_id) continue;
    if (workshopEventIds.has(it.event_id)) workshopScheduleIds.add(it.schedule_id);
    if (attachmentEventIds.has(it.event_id)) photoScheduleIds.add(it.schedule_id);
  }

  const components = computeComponentViews(schedules, statuses, events, itemsByScheduleId, inspectionsByScheduleId, {
    usage: { hours: moto.hours_total != null ? Number(moto.hours_total) : null, km: moto.km_total != null ? Number(moto.km_total) : null },
    workshopScheduleIds,
    photoScheduleIds,
  });
  const actionPlan = computeActionPlan(components);
  const rideAnswer = computeRideAnswer({ components, actionPlan });
  const health = computeHealth({ moto, events, attachments, statuses, workshopEventIds, components });
  const greeting = computeGreeting({ moto, health, nextMaintenance, nextAction });

  return {
    motoId: moto.id,
    isOwner,
    health,
    nextMaintenance,
    stats,
    nextAlert,
    nextAction,
    components,
    greeting,
    actionPlan,
    actionSummary: summarizeActionPlan(actionPlan),
    rideAnswer,
  };
}