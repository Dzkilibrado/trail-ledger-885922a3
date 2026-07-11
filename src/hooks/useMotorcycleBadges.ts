import { useMemo } from "react";
import { useMotorcycleEvidence } from "./useMotorcycleEvidence";
import { evaluateBadges, summarize, type BadgeSummary } from "@/lib/badges";

/**
 * Deriva os selos de qualidade de uma motocicleta a partir das evidências
 * existentes. Retorna `null` enquanto os dados carregam para que a UI possa
 * decidir entre esconder o bloco ou exibir skeleton.
 */
export function useMotorcycleBadges(motorcycleId: string | undefined) {
  const { evidence, isLoading } = useMotorcycleEvidence(motorcycleId);
  const summary = useMemo<BadgeSummary | null>(() => {
    if (!evidence) return null;
    return summarize(evaluateBadges(evidence));
  }, [evidence]);
  return { summary, evidence, isLoading };
}