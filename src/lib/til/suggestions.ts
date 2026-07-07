import type { ScheduleStatus } from "@/lib/maintenance-engine";
import type { EventRow, Moto, NextAction } from "./types";

/**
 * Próxima ação sugerida — o usuário nunca procura o que fazer.
 * Ordem de prioridade:
 * 1. Plano de manutenção não revisado (moto usada).
 * 2. Manutenção vencida.
 * 3. Manutenção vencendo em breve.
 * 4. Sem eventos registrados → registrar atividade.
 */
export function computeNextAction(input: {
  moto: Moto;
  statuses: ScheduleStatus[];
  events: EventRow[];
  isOwner: boolean;
}): NextAction | null {
  const { moto, statuses, events, isOwner } = input;
  if (!isOwner) return null;

  if ((moto as any).condition === "used" && (moto as any).plan_review_status === "pending") {
    return {
      kind: "review_plan",
      label: "Revisar plano de manutenção",
      reason: "Moto usada — ajuste o estado atual dos itens antes de ativar os alertas.",
    };
  }

  const overdue = statuses.find((s) => s.status === "overdue");
  if (overdue) {
    return {
      kind: "register_maintenance",
      label: "Registrar manutenção agora",
      reason: `${overdue.label} está vencida.`,
      scheduleId: overdue.schedule.id,
    };
  }

  const due = statuses.find((s) => s.status === "due");
  if (due) {
    return {
      kind: "register_maintenance",
      label: "Registrar manutenção",
      reason: `${due.label} vence agora.`,
      scheduleId: due.schedule.id,
    };
  }

  if (events.length === 0) {
    return {
      kind: "register_activity",
      label: "Registrar primeira atividade",
      reason: "Comece a acompanhar horas e quilometragem da sua moto.",
    };
  }

  return null;
}