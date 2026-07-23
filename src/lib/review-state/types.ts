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
  /**
   * Verdadeiro quando todos os componentes já possuem `last_done_*`
   * (via manutenção avulsa, ComponentSheet, recomposição etc.) mas o
   * proprietário ainda não confirmou oficialmente a revisão inicial.
   * Máquina de estados mantém `partially_reviewed` — este flag serve
   * apenas para a camada de comunicação/CTA.
   */
  isReadyToComplete: boolean;
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
  partially_reviewed: "Revisão inicial em andamento",
  fully_reviewed: "Revisão inicial concluída",
};

/**
 * Título oficial quando todos os componentes já foram registrados
 * individualmente, mas a revisão inicial ainda aguarda confirmação
 * explícita do proprietário.
 */
export const REVIEW_READY_TO_COMPLETE_TITLE = "Revisão pronta para concluir";

/**
 * Mensagem oficial para o cenário `isReadyToComplete`.
 * Nunca menciona "componentes sem confirmação".
 */
export const REVIEW_READY_TO_COMPLETE_MESSAGE =
  "Todos os componentes possuem informações registradas, mas a revisão inicial ainda não foi confirmada oficialmente. Confirme a conclusão para que o TrailBook registre este momento como o início oficial do acompanhamento da motocicleta.";

/**
 * CTA oficial para o cenário `isReadyToComplete`.
 */
export const REVIEW_READY_TO_COMPLETE_CTA = "Concluir revisão";

/**
 * Mensagens longas oficiais — fonte única para todas as telas.
 * `partially_reviewed` recebe o número de componentes pendentes.
 * Quando `remaining === 0` e o estado ainda é `partially_reviewed`,
 * a mensagem muda para o cenário "pronta para concluir" — nunca
 * afirma que existem componentes sem confirmação.
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
      if (remaining <= 0) {
        // Cenário B: todos registrados, aguardando confirmação oficial.
        return REVIEW_READY_TO_COMPLETE_MESSAGE;
      }
      return `Parte da revisão inicial já foi registrada. Ainda ${
        remaining === 1
          ? "resta 1 componente para confirmar"
          : `restam ${remaining} componentes para confirmar`
      }.`;
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