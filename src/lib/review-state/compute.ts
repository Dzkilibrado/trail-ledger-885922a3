import {
  REVIEW_STATE_CTA,
  REVIEW_STATE_TITLE,
  REVIEW_STATE_TONE,
  reviewStateMessage,
  type MotorcycleReviewState,
  type ReviewStateSnapshot,
} from "./types";

type MotoLike = {
  condition?: string | null;
  hours_initial?: number | null;
  km_initial?: number | null;
  initial_review_done_at?: string | null;
};

type ScheduleLike = {
  status?: string | null;
  last_done_at?: string | null;
  last_done_hours?: number | null;
  last_done_km?: number | null;
};

function isConfirmed(s: ScheduleLike): boolean {
  return !!(s.last_done_at || s.last_done_hours != null || s.last_done_km != null);
}

function isRelevant(s: ScheduleLike): boolean {
  return s.status !== "not_applicable";
}

function isUsed(moto: MotoLike): boolean {
  return (
    moto.condition === "used" ||
    Number(moto.hours_initial ?? 0) > 0 ||
    Number(moto.km_initial ?? 0) > 0
  );
}

/**
 * Regras determinísticas de transição (ver plano):
 * 1. initial_review_done_at presente → fully_reviewed
 * 2. Não é usada e nenhum schedule confirmado → unknown
 * 3. Usada, 0 confirmados → baseline_only
 * 4. 0 < confirmados < total → partially_reviewed
 * 5. Todos confirmados mas marcador oficial ainda nulo → partially_reviewed
 *    (só vira fully_reviewed quando o fluxo oficial grava o marcador).
 */
export function computeReviewState(input: {
  moto: MotoLike;
  schedules: ScheduleLike[];
}): ReviewStateSnapshot {
  const { moto, schedules } = input;
  const relevant = (schedules ?? []).filter(isRelevant);
  const totalCount = relevant.length;
  const confirmedCount = relevant.filter(isConfirmed).length;
  const remainingCount = Math.max(0, totalCount - confirmedCount);

  let state: MotorcycleReviewState;
  if (moto.initial_review_done_at) {
    state = "fully_reviewed";
  } else if (!isUsed(moto) && confirmedCount === 0) {
    state = "unknown";
  } else if (confirmedCount === 0) {
    state = "baseline_only";
  } else {
    state = "partially_reviewed";
  }

  return {
    state,
    isPending: state !== "fully_reviewed",
    isComplete: state === "fully_reviewed",
    confirmedCount,
    totalCount,
    remainingCount,
    tone: REVIEW_STATE_TONE[state],
    title: REVIEW_STATE_TITLE[state],
    message: reviewStateMessage(state, remainingCount),
    cta: REVIEW_STATE_CTA[state],
  };
}