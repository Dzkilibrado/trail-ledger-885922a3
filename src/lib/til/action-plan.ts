import type { ComponentView } from "./components";
import type { HealthStatus } from "./status";
import { HEALTH_STATUS_WEIGHT } from "./status";

/**
 * TrailBook Health — Plano de Ação.
 *
 * Regra oficial: o TrailBook nunca entrega apenas um diagnóstico.
 * Todo diagnóstico gera uma recomendação clara e priorizada.
 *
 * Ordem: 🔴 Crítico → 🟡 Preventivo → ⚪ Informação faltando.
 */

export type ActionPriority = "critical" | "preventive" | "informative";

export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  critical: "Resolver antes de rodar",
  preventive: "Programar manutenção",
  informative: "Completar informação",
};

export interface ActionPlanItem {
  scheduleId: string;
  title: string;
  category: string;
  status: HealthStatus;
  priority: ActionPriority;
  /** Por que está aqui — uma frase. */
  reason: string;
  /** O que fazer — uma frase. */
  recommendation: string;
  actionHint: string;
}

const SEVERITY_WEIGHT: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function priorityFor(status: HealthStatus): ActionPriority | null {
  if (status === "action") return "critical";
  if (status === "attention") return "preventive";
  if (status === "unknown") return "informative";
  return null;
}

/** Constrói o plano de ação priorizado a partir dos componentes da moto. */
export function computeActionPlan(components: ComponentView[]): ActionPlanItem[] {
  const items: ActionPlanItem[] = [];

  for (const c of components) {
    if (c.hidden || c.rawStatus === "not_applicable") continue;
    const status = c.diagnosis.status;
    const priority = priorityFor(status);
    if (!priority) continue;

    items.push({
      scheduleId: c.scheduleId,
      title: c.name,
      category: c.categoryLabel,
      status,
      priority,
      reason: c.diagnosis.reasons[c.diagnosis.reasons.length - 1] ?? c.statusLabel,
      recommendation: c.diagnosis.conclusion,
      actionHint: c.actionHint,
    });
  }

  const order: ActionPriority[] = ["critical", "preventive", "informative"];
  return items.sort((a, b) => {
    const p = order.indexOf(a.priority) - order.indexOf(b.priority);
    if (p !== 0) return p;
    const s = HEALTH_STATUS_WEIGHT[a.status] - HEALTH_STATUS_WEIGHT[b.status];
    if (s !== 0) return s;
    return a.title.localeCompare(b.title);
  });
}

/** Resumo curto do plano — usado no Cockpit e no cabeçalho da Saúde. */
export function summarizeActionPlan(plan: ActionPlanItem[]): string {
  const critical = plan.filter((i) => i.priority === "critical").length;
  const preventive = plan.filter((i) => i.priority === "preventive").length;
  const informative = plan.filter((i) => i.priority === "informative").length;

  if (critical > 0) {
    return critical === 1
      ? "1 item precisa ser resolvido antes de rodar"
      : `${critical} itens precisam ser resolvidos antes de rodar`;
  }
  if (preventive > 0) {
    return preventive === 1
      ? "1 manutenção deve ser programada"
      : `${preventive} manutenções devem ser programadas`;
  }
  if (informative > 0) {
    return informative === 1
      ? "1 componente ainda sem informação"
      : `${informative} componentes ainda sem informação`;
  }
  return "Nenhuma ação pendente";
}

export { SEVERITY_WEIGHT as ACTION_SEVERITY_WEIGHT };
