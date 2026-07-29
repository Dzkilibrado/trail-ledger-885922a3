import type { CockpitSnapshot } from "@/lib/til";
import { EvaluationCard } from "@/components/health/EvaluationCard";

/**
 * Avaliação da moto no Cockpit — estrutura oficial TrailBook Health 4.0:
 * avaliação → diagnóstico → achados → recomendação → posso rodar hoje.
 */
export function HealthHeroWidget({ snapshot }: { snapshot: CockpitSnapshot }) {
  return <EvaluationCard answer={snapshot.rideAnswer} compact />;
}
