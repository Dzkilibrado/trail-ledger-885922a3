/**
 * Selos de Qualidade do Histórico — tipos oficiais.
 *
 * Princípios (ADR 0007):
 * - Registry declarativo: cada selo é apenas um objeto neste módulo.
 * - Motor puro: `evaluate(snapshot) -> BadgeEvaluation`. Sem I/O.
 * - Conquista é consequência: selos são DERIVADOS de evidências, nunca
 *   armazenados em banco (Fase 1). Isso garante coerência com o princípio
 *   de Preservação de Histórico — se a evidência muda, o selo muda junto.
 */

import type { DocType } from "@/lib/motorcycle-documents";
import type { HealthGrade } from "@/lib/til/types";

export type BadgeId =
  | "origin_proven"
  | "documentation_complete"
  | "timeline_rich"
  | "maintenance_on_track"
  | "ownership_chain_intact"
  | "official_photos"
  | "history_complete";

export type BadgeTier = "bronze" | "silver" | "gold" | "signature";

export type BadgeState = "earned" | "partial" | "locked";

export type CriterionState = "met" | "unmet" | "n/a";

export type Criterion = {
  label: string;
  state: CriterionState;
  /** Detalhe opcional exibido em cinza claro no tooltip. */
  hint?: string;
};

export type BadgeEvaluationResult = {
  state: BadgeState;
  criteria: Criterion[];
  /** 0..1 — usado para barra de progresso quando `state === "partial"`. */
  progress?: number;
};

export type EvidenceSnapshot = {
  motoId: string;
  documents: {
    /** Contagem por tipo, considerando apenas `is_current && !deleted_at`. */
    activeByType: Partial<Record<DocType, number>>;
    hasOriginDocument: boolean;
    activeTotal: number;
  };
  timeline: {
    eventCount: number;
    firstEventAt: string | null;
    lastEventAt: string | null;
  };
  maintenance: {
    overdueCount: number;
    attentionCount: number;
    grade: HealthGrade | "unknown";
    hasComponents: boolean;
  };
  ownership: {
    entries: number;
    hasOpenCurrentOwner: boolean;
    gaps: number;
  };
  photos: {
    total: number;
    hasCover: boolean;
  };
};

export type BadgeDefinition = {
  id: BadgeId;
  title: string;
  /** Rótulo curto para chips (≤ 2 palavras). */
  short: string;
  tier: BadgeTier;
  /** Emoji ou glyph curto. Renderizado como texto — sem depender de lib. */
  glyph: string;
  /** Uma frase — "o que este selo significa". */
  description: string;
  /** Motor puro: recebe evidence, devolve estado + critérios. */
  evaluate: (evidence: EvidenceSnapshot) => BadgeEvaluationResult;
};

export type BadgeEvaluation = {
  definition: BadgeDefinition;
  state: BadgeState;
  criteria: Criterion[];
  progress: number;
};

export type BadgeSummary = {
  earned: BadgeEvaluation[];
  partial: BadgeEvaluation[];
  locked: BadgeEvaluation[];
  all: BadgeEvaluation[];
  /** Índice geral 0..100 baseado em selos ganhos (com peso por tier). */
  score: number;
};