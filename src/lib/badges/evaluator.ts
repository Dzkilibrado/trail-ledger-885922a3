/**
 * Motor de avaliação — puro, determinístico, testável.
 */

import type { BadgeEvaluation, BadgeSummary, EvidenceSnapshot } from "./types";
import { BADGES, TIER_WEIGHT } from "./registry";

export function evaluateBadges(evidence: EvidenceSnapshot): BadgeEvaluation[] {
  return BADGES.map((def) => {
    const r = def.evaluate(evidence);
    return {
      definition: def,
      state: r.state,
      criteria: r.criteria,
      progress: typeof r.progress === "number" ? Math.max(0, Math.min(1, r.progress)) : 0,
    };
  });
}

export function summarize(evaluations: BadgeEvaluation[]): BadgeSummary {
  const earned = evaluations.filter((e) => e.state === "earned");
  const partial = evaluations.filter((e) => e.state === "partial");
  const locked = evaluations.filter((e) => e.state === "locked");
  const totalWeight = evaluations.reduce((s, e) => s + TIER_WEIGHT[e.definition.tier], 0);
  const earnedWeight = earned.reduce((s, e) => s + TIER_WEIGHT[e.definition.tier], 0);
  const score = totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);
  return { earned, partial, locked, all: evaluations, score };
}

export function emptyEvidence(motoId: string): EvidenceSnapshot {
  return {
    motoId,
    documents: { activeByType: {}, hasOriginDocument: false, activeTotal: 0 },
    timeline: { eventCount: 0, firstEventAt: null, lastEventAt: null },
    maintenance: { overdueCount: 0, attentionCount: 0, grade: "unknown", hasComponents: false },
    ownership: { entries: 0, hasOpenCurrentOwner: false, gaps: 0 },
    photos: { total: 0, hasCover: false },
  };
}