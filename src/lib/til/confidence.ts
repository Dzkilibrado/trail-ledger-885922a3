import { DATA_LABEL, IMPROVE_ACTION } from "./messages";

/**
 * TrailBook Health — Confiabilidade da análise.
 *
 * IMPORTANTE: confiabilidade NÃO é estado de conservação.
 * Ela mede a qualidade dos dados usados para chegar ao diagnóstico.
 */

export type ConfidenceLevel = "high" | "medium" | "low" | "not_evaluable";

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "Alta confiabilidade",
  medium: "Média confiabilidade",
  low: "Baixa confiabilidade",
  not_evaluable: "Não avaliável",
};

export const CONFIDENCE_SHORT: Record<ConfidenceLevel, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  not_evaluable: "Não avaliável",
};

export const CONFIDENCE_DESCRIPTION: Record<ConfidenceLevel, string> = {
  high: "Existem registros suficientes, recentes e consistentes.",
  medium: "A análise é possível, mas faltam alguns registros importantes.",
  low: "Existem poucos dados ou as informações estão desatualizadas.",
  not_evaluable: "Não há informações suficientes para avaliar este item.",
};

export const CONFIDENCE_TEXT_CLASS: Record<ConfidenceLevel, string> = {
  high: "text-emerald-500",
  medium: "text-amber-400",
  low: "text-destructive",
  not_evaluable: "text-muted-foreground",
};

export interface DataSignal {
  key: string;
  label: string;
  /** Ação que o usuário pode executar para suprir o dado ausente. */
  improveAction?: string;
}

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  label: string;
  /** Motivo em uma frase, montado a partir dos sinais. */
  reason: string;
  /** Dados que fortaleceram a análise. */
  used: DataSignal[];
  /** Dados ausentes que melhorariam a análise. */
  missing: DataSignal[];
  /** Próxima ação de maior impacto na confiabilidade. */
  bestNextAction: string | null;
}

function signal(key: string): DataSignal {
  return { key, label: DATA_LABEL[key] ?? key, improveAction: IMPROVE_ACTION[key] };
}

/**
 * Avalia a confiabilidade a partir dos sinais disponíveis.
 * `evaluable = false` força "Não avaliável" (não existe base para diagnosticar).
 */
export function computeConfidence(input: {
  evaluable: boolean;
  usedKeys: string[];
  missingKeys: string[];
  /** Dias desde o registro mais recente relevante (null = nenhum). */
  daysSinceLastRecord: number | null;
  /** Conflito entre horas, km e datas detectado. */
  hasConflict?: boolean;
}): ConfidenceAssessment {
  const used = input.usedKeys.map(signal);
  const missing = input.missingKeys.map(signal);

  let level: ConfidenceLevel;
  if (!input.evaluable) {
    level = "not_evaluable";
  } else if (input.hasConflict) {
    level = "low";
  } else if (used.length >= 4 && (input.daysSinceLastRecord == null || input.daysSinceLastRecord <= 365)) {
    level = "high";
  } else if (used.length >= 2) {
    level = input.daysSinceLastRecord != null && input.daysSinceLastRecord > 730 ? "low" : "medium";
  } else {
    level = "low";
  }

  const reasonParts: string[] = [];
  if (used.length) reasonParts.push(`Consideramos ${used.map((u) => u.label.toLowerCase()).join(", ")}`);
  if (missing.length) reasonParts.push(`faltam ${missing.map((m) => m.label.toLowerCase()).join(", ")}`);
  if (input.hasConflict) reasonParts.push("existem informações conflitantes entre horas, quilometragem e datas");
  if (input.daysSinceLastRecord != null && input.daysSinceLastRecord > 730) {
    reasonParts.push("o registro mais recente é antigo");
  }

  const reason = reasonParts.length
    ? `${reasonParts.join("; ")}.`
    : CONFIDENCE_DESCRIPTION[level];

  return {
    level,
    label: CONFIDENCE_LABEL[level],
    reason,
    used,
    missing,
    bestNextAction: missing[0]?.improveAction ?? null,
  };
}
