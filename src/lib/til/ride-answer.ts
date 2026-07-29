import type { ComponentView } from "./components";
import type { HealthStatus } from "./status";
import { worstStatus } from "./status";
import {
  RIDE_ANSWER_DISCLAIMER,
  RIDE_ANSWER_MESSAGE,
  RIDE_ANSWER_TITLE,
} from "./messages";
import type { ActionPlanItem } from "./action-plan";

/**
 * TrailBook Health — resposta oficial para "Posso rodar hoje?".
 * Sempre com status, mensagem, justificativa, contagens, próxima ação e ressalva.
 */
export interface RideAnswer {
  status: HealthStatus;
  title: string;
  message: string;
  /** Justificativa resumida em uma frase. */
  rationale: string;
  counts: {
    critical: number;
    attention: number;
    ok: number;
    unknown: number;
    total: number;
  };
  nextAction: {
    label: string;
    scheduleId: string;
    dueEstimateLabel: string;
  } | null;
  disclaimer: string;
}

export function computeRideAnswer(input: {
  components: ComponentView[];
  actionPlan: ActionPlanItem[];
}): RideAnswer {
  const evaluated = input.components.filter((c) => !c.hidden && c.rawStatus !== "not_applicable");
  const counts = {
    critical: evaluated.filter((c) => c.diagnosis.status === "action").length,
    attention: evaluated.filter((c) => c.diagnosis.status === "attention").length,
    ok: evaluated.filter((c) => c.diagnosis.status === "ok").length,
    unknown: evaluated.filter((c) => c.diagnosis.status === "unknown").length,
    total: evaluated.length,
  };

  const status: HealthStatus =
    evaluated.length === 0 ? "unknown" : worstStatus(evaluated.map((c) => c.diagnosis.status));

  const top = input.actionPlan[0] ?? null;
  const topComponent = top ? evaluated.find((c) => c.scheduleId === top.scheduleId) ?? null : null;

  let rationale: string;
  if (status === "action") {
    rationale = counts.critical === 1
      ? `1 item precisa ser verificado antes de rodar${topComponent ? `: ${topComponent.name}` : ""}.`
      : `${counts.critical} itens precisam ser verificados antes de rodar.`;
  } else if (status === "attention") {
    rationale = counts.attention === 1
      ? `1 item merece acompanhamento${topComponent ? `: ${topComponent.name}` : ""}.`
      : `${counts.attention} itens merecem acompanhamento.`;
  } else if (status === "unknown") {
    rationale = counts.total === 0
      ? "Nenhum componente foi cadastrado ou avaliado até o momento."
      : `${counts.unknown} componentes ainda não possuem dados suficientes.`;
  } else {
    rationale = `Com base nos registros disponíveis, ${counts.ok} componentes estão dentro do previsto e nenhum item crítico foi identificado.`;
  }

  return {
    status,
    title: RIDE_ANSWER_TITLE[status],
    message: RIDE_ANSWER_MESSAGE[status],
    rationale,
    counts,
    nextAction: top
      ? { label: top.recommendation, scheduleId: top.scheduleId, dueEstimateLabel: top.dueEstimateLabel }
      : null,
    disclaimer: RIDE_ANSWER_DISCLAIMER,
  };
}
