/**
 * TrailBook Health 4.0 — camada de APRESENTAÇÃO da avaliação.
 *
 * REGRA OFICIAL: o proprietário nunca vê nota, percentual, peso ou cálculo.
 * Este módulo NÃO altera nenhuma regra da TIL: ele apenas traduz o resultado
 * já calculado (status, contagens, plano de ação) para a linguagem oficial
 * Avaliação → Diagnóstico → Achados → Recomendação → Posso rodar hoje?
 */
import type { HealthStatus } from "@/lib/til/status";
import type { RideAnswer } from "@/lib/til/ride-answer";

export type EvaluationState = "no_data" | "healthy" | "attention" | "review" | "action";

export const EVALUATION_LABEL: Record<EvaluationState, string> = {
  no_data: "Sem dados suficientes",
  healthy: "Saudável",
  attention: "Atenção",
  review: "Revisão recomendada",
  action: "Necessita ação",
};

export const EVALUATION_DOT: Record<EvaluationState, string> = {
  no_data: "bg-muted-foreground",
  healthy: "bg-emerald-500",
  attention: "bg-amber-400",
  review: "bg-orange-500",
  action: "bg-destructive",
};

export const EVALUATION_TEXT: Record<EvaluationState, string> = {
  no_data: "text-muted-foreground",
  healthy: "text-emerald-500",
  attention: "text-amber-400",
  review: "text-orange-500",
  action: "text-destructive",
};

export const EVALUATION_SOFT: Record<EvaluationState, string> = {
  no_data: "bg-muted text-muted-foreground ring-border",
  healthy: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
  attention: "bg-amber-500/10 text-amber-400 ring-amber-400/25",
  review: "bg-orange-500/10 text-orange-500 ring-orange-500/25",
  action: "bg-destructive/10 text-destructive ring-destructive/25",
};

/** Conclusão oficial: "Posso rodar hoje?" */
export const RIDE_VERDICT: Record<EvaluationState, string> = {
  no_data: "Ainda não existem informações suficientes para responder com segurança.",
  healthy: "Pode utilizar normalmente.",
  attention: "Pode utilizar, porém acompanhe os itens indicados.",
  review: "Pode utilizar, porém recomendamos programar uma revisão.",
  action: "Não recomendamos utilizar esta motocicleta antes da correção dos itens críticos.",
};

/** Recomendação prática padrão. */
export const EVALUATION_RECOMMENDATION: Record<EvaluationState, string> = {
  no_data:
    "Comece registrando a última manutenção conhecida e a leitura atual de horímetro ou quilometragem. Com esses dados o TrailBook consegue avaliar sua motocicleta.",
  healthy:
    "Continue registrando as atividades e manutenções. É esse histórico que mantém a avaliação confiável e valoriza sua motocicleta.",
  attention:
    "Acompanhe os itens indicados e programe a manutenção antes que se tornem críticos. Depois, registre o serviço realizado.",
  review:
    "Programe uma revisão para os itens indicados. Após concluir, registre os serviços realizados para manter o histórico atualizado.",
  action:
    "Priorize a correção dos itens críticos. Após concluir as manutenções, registre os serviços realizados para manter o histórico atualizado.",
};

export const EVALUATION_INTRO =
  "O TrailBook avaliou sua motocicleta utilizando todas as informações registradas até este momento.";

/** Estado de apresentação a partir do status técnico da TIL (sem alterá-lo). */
export function stateFromStatus(status: HealthStatus): EvaluationState {
  if (status === "action") return "action";
  if (status === "attention") return "attention";
  if (status === "unknown") return "no_data";
  return "healthy";
}

/**
 * Estado de apresentação a partir da resposta oficial da TIL.
 * "Revisão recomendada" é um refinamento visual de "Atenção" quando
 * existem vários itens em acompanhamento — nenhuma regra é alterada.
 */
export function stateFromRideAnswer(answer: RideAnswer): EvaluationState {
  const { counts, status } = answer;
  if (status === "action" || counts.critical > 0) return "action";
  if (status === "attention") return counts.attention >= 3 ? "review" : "attention";
  if (status === "unknown") return "no_data";
  return "healthy";
}

/** Tradução de nota interna legada (0..100) em estado — nunca exibir o número. */
export function stateFromScore(score: number | null | undefined): EvaluationState {
  if (score == null || score <= 0) return "no_data";
  if (score >= 85) return "healthy";
  if (score >= 70) return "attention";
  if (score >= 50) return "review";
  return "action";
}

export interface EvaluationView {
  state: EvaluationState;
  label: string;
  intro: string;
  /** "O que encontramos durante a avaliação?" — em linguagem simples. */
  findings: string[];
  recommendation: string;
  verdict: string;
  disclaimer: string;
}

/** Monta a avaliação completa a partir do resultado já calculado pela TIL. */
export function buildEvaluation(
  answer: RideAnswer,
  extras?: { findings?: string[]; recommendation?: string },
): EvaluationView {
  const state = stateFromRideAnswer(answer);
  const c = answer.counts;
  const findings: string[] = [];

  if (c.critical > 0) {
    findings.push(
      c.critical === 1
        ? "Foi identificado 1 item crítico."
        : `Foram identificados ${c.critical} itens críticos.`,
    );
  }
  if (c.attention > 0) {
    findings.push(
      c.attention === 1
        ? "Encontramos 1 item que merece acompanhamento."
        : `Encontramos ${c.attention} itens que merecem acompanhamento.`,
    );
  }
  if (c.ok > 0) {
    findings.push(
      c.ok === 1
        ? "1 item está dentro das condições esperadas."
        : `${c.ok} itens estão dentro das condições esperadas.`,
    );
  }
  if (c.unknown > 0) {
    findings.push(
      c.unknown === 1
        ? "1 item ainda não possui informações suficientes."
        : `${c.unknown} itens ainda não possuem informações suficientes.`,
    );
  }
  if (c.total === 0) {
    findings.push("Não localizamos registros suficientes para avaliar esta motocicleta.");
  }
  if (answer.nextAction) {
    findings.push(`Próxima ação sugerida: ${answer.nextAction.label}.`);
  }
  for (const extra of extras?.findings ?? []) findings.push(extra);

  return {
    state,
    label: EVALUATION_LABEL[state],
    intro: EVALUATION_INTRO,
    findings,
    recommendation: extras?.recommendation ?? EVALUATION_RECOMMENDATION[state],
    verdict: RIDE_VERDICT[state],
    disclaimer: answer.disclaimer,
  };
}
