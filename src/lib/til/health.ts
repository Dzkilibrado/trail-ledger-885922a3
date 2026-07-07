import { computeConservation } from "@/lib/conservation";
import type { ScheduleStatus } from "@/lib/maintenance-engine";
import type { HealthSnapshot, EventRow, Attachment, Moto } from "./types";

/**
 * Índice de saúde da moto (0..100) + frase única + tom visual.
 * Reutiliza a lógica canônica de conservação — telas nunca calculam.
 */
export function computeHealth(input: {
  moto: Pick<Moto, "plate" | "renavam" | "chassis">;
  events: EventRow[];
  attachments: Attachment[];
  statuses: ScheduleStatus[];
  workshopEventIds: Set<string>;
}): HealthSnapshot {
  const c = computeConservation({
    events: input.events,
    attachments: input.attachments,
    statuses: input.statuses,
    workshopEventIds: input.workshopEventIds,
    hasDocs: {
      plate: !!input.moto.plate,
      renavam: !!input.moto.renavam,
      chassis: !!input.moto.chassis,
    },
  });
  const score = c.score;
  if (score >= 85) return { score, tone: "good", label: "Sua moto está saudável" };
  if (score >= 70) return { score, tone: "good", label: "Sua moto está em boa forma" };
  if (score >= 55) return { score, tone: "warn", label: "Sua moto pede atenção" };
  return { score, tone: "bad", label: "Sua moto precisa de cuidados" };
}