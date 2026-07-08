import type { HealthSnapshot, Moto, NextAction, NextMaintenanceSnapshot } from "./types";

/**
 * Frase contextual do assistente TrailBook — curta, útil e humana.
 * Regras:
 * - Prioriza pendências críticas.
 * - Depois manutenção próxima.
 * - Depois estado geral.
 * Nunca institucional; sempre soa como um copiloto direto.
 */
export function computeGreeting(input: {
  moto: Pick<Moto, "nickname" | "model">;
  health: HealthSnapshot;
  nextMaintenance: NextMaintenanceSnapshot | null;
  nextAction: NextAction | null;
}): string {
  const { health, nextMaintenance, nextAction, moto } = input;
  const name = moto.nickname?.trim() || moto.model?.trim() || "sua moto";

  if (health.grade === "critical") {
    const top = health.topAttention?.name;
    return top
      ? `Atenção: ${top} precisa ser resolvido antes do próximo uso.`
      : "Existe uma manutenção que merece atenção antes do próximo uso.";
  }

  if (nextMaintenance && (nextMaintenance.status === "due" || nextMaintenance.status === "soon")) {
    return `${nextMaintenance.remainingLabel.replace(/^./, (c) => c.toUpperCase())} para ${nextMaintenance.name.toLowerCase()}.`;
  }

  if (health.grade === "attention") {
    return "Alguns componentes merecem uma olhada antes da próxima trilha.";
  }

  if (nextAction?.kind === "review_plan") {
    return "Revise o plano de manutenção para ativar seus alertas.";
  }

  if (nextAction?.kind === "register_activity") {
    return `Registre a primeira atividade da ${name} para começar o acompanhamento.`;
  }

  if (health.grade === "excellent") {
    return `Sua ${name} está pronta para a próxima trilha.`;
  }

  return "Nenhuma pendência encontrada. Boa pilotagem!";
}