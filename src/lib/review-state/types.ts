/**
 * MotorcycleReviewState — estado oficial da revisão inicial da moto.
 *
 * Camada exclusiva de UX/comunicação. Não substitui e não altera nenhum
 * cálculo do motor de manutenção (evaluateSchedule, TIL, recomposição,
 * baseline). Serve apenas para unificar a mensagem exibida em Dashboard,
 * Cockpit, Passaporte, Saúde, Agenda e futuras notificações.
 */
export type MotorcycleReviewState =
  | "unknown"
  | "baseline_only"
  | "partially_reviewed"
  | "fully_reviewed";

export type ReviewStateTone = "info" | "attention" | "good";

export interface ReviewStateSnapshot {
  state: MotorcycleReviewState;
  isPending: boolean;
  isComplete: boolean;
  confirmedCount: number;
  totalCount: number;
  remainingCount: number;
  tone: ReviewStateTone;
  /** Rótulo curto (chips/badges). */
  title: string;
  /** Frase longa oficial (cards/dialogs). */
  message: string;
  /** CTA principal quando aplicável. */
  cta: string | null;
}

/**
 * Rótulos curtos oficiais — usados em chips/badges.
 */
export const REVIEW_STATE_TITLE: Record<MotorcycleReviewState, string> = {
  unknown: "Aguardando revisão inicial",
  baseline_only: "Aguardando revisão inicial",
  partially_reviewed: "Revisão inicial parcial",
  fully_reviewed: "Revisão inicial concluída",
};

/**
 * Mensagens longas oficiais — fonte única para todas as telas.
 * `partially_reviewed` recebe o número de componentes pendentes.
 */
export function reviewStateMessage(
  state: MotorcycleReviewState,
  remaining = 0,
): string {
  switch (state) {
    case "unknown":
      return "Aguardando informações iniciais.";
    case "baseline_only":
      return "Estamos utilizando as horas e quilômetros informados no cadastro como ponto inicial do acompanhamento. Recomendamos confirmar a revisão inicial da motocicleta para que o histórico reflita o estado físico dos componentes.";
    case "partially_reviewed":
      return remaining > 0
        ? `Parte da revisão inicial já foi registrada. Ainda ${
            remaining === 1 ? "existe 1 componente" : `existem ${remaining} componentes`
          } sem confirmação.`
        : "Parte da revisão inicial já foi registrada. Ainda existem componentes sem confirmação.";
    case "fully_reviewed":
      return "Revisão inicial concluída. A partir deste momento o TrailBook acompanhará automaticamente os próximos vencimentos e o histórico de manutenção.";
  }
}

export const REVIEW_STATE_TONE: Record<MotorcycleReviewState, ReviewStateTone> = {
  unknown: "info",
  baseline_only: "attention",
  partially_reviewed: "attention",
  fully_reviewed: "good",
};

export const REVIEW_STATE_CTA: Record<MotorcycleReviewState, string | null> = {
  unknown: null,
  baseline_only: "Revisar agora",
  partially_reviewed: "Continuar revisão",
  fully_reviewed: null,
};