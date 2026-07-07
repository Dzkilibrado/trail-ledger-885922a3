import { computeHealth } from "./health";
import { computeStatuses, computeNextMaintenance } from "./schedule";
import { computeStats } from "./usage";
import { computeNextAlert } from "./alerts";
import { computeNextAction } from "./suggestions";
import type {
  Attachment,
  CockpitSnapshot,
  EventRow,
  Moto,
  Schedule,
} from "./types";

export * from "./types";

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
}): CockpitSnapshot {
  const { moto, events, schedules, attachments, isOwner } = input;
  const workshopEventIds = new Set(events.filter((e) => e.workshop_id).map((e) => e.id));
  const statuses = computeStatuses(moto, schedules, events);
  const health = computeHealth({ moto, events, attachments, statuses, workshopEventIds });
  const nextMaintenance = computeNextMaintenance(statuses);
  const stats = computeStats(moto, events);
  const nextAlert = computeNextAlert(statuses);
  const nextAction = computeNextAction({ moto, statuses, events, isOwner });

  return {
    motoId: moto.id,
    isOwner,
    health,
    nextMaintenance,
    stats,
    nextAlert,
    nextAction,
  };
}