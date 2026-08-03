import type { ComponentView } from "./components";
import type { HealthStatus } from "./status";
import { HEALTH_STATUS_WEIGHT } from "./status";
import {
  RECOMMENDATION_ACTION_LABEL,
  type RecommendationAction,
  type RecommendationStatus,
} from "./recommendations";

/**
 * TrailBook Health — Plano de Ação.
 *
 * Todo diagnóstico gera uma recomendação clara, priorizada e rastreável.
 * Grupos oficiais (nesta ordem):
 *   1. Faça antes de usar   — segurança / funcionamento comprometido
 *   2. Programe em breve    — próximo da manutenção recomendada
 *   3. Acompanhe            — ainda não exige intervenção
 *   4. Complete os dados    — não foi possível avaliar
 */

export type ActionGroup = "before_use" | "schedule_soon" | "monitor" | "complete_data";

export const ACTION_GROUP_LABEL: Record<ActionGroup, string> = {
  before_use: "Faça antes de usar",
  schedule_soon: "Programe em breve",
  monitor: "Acompanhe",
  complete_data: "Complete os dados",
};

export const ACTION_GROUP_DESCRIPTION: Record<ActionGroup, string> = {
  before_use: "Itens que podem comprometer segurança ou funcionamento.",
  schedule_soon: "Itens próximos da manutenção recomendada.",
  monitor: "Itens que ainda não exigem intervenção.",
  complete_data: "Itens que não puderam ser avaliados por falta de informação.",
};

/** Compatibilidade com a Etapa 1. */
export type ActionPriority = "critical" | "preventive" | "informative" | "monitor";

export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  critical: "Resolver antes de rodar",
  preventive: "Programar manutenção",
  monitor: "Acompanhar",
  informative: "Completar informação",
};

export interface ActionPlanItem {
  scheduleId: string;
  title: string;
  category: string;
  status: HealthStatus;
  group: ActionGroup;
  priority: ActionPriority;
  /** Por que está aqui. */
  reason: string;
  /** O que fazer. */
  recommendation: string;
  /** Prazo estimado em linguagem natural. */
  dueEstimateLabel: string;
  /** Origem do diagnóstico (regras acionadas + versão do algoritmo). */
  origin: { rules: string[]; ruleVersion: string; computedAt: string };
  /** Ação sugerida principal + alternativas. */
  suggestedAction: RecommendationAction;
  suggestedActionLabel: string;
  alternativeActions: RecommendationAction[];
  /** Estado de acompanhamento derivado (ciclo de vida). */
  lifecycle: RecommendationStatus;
  confidenceLevel: string;
  isSafetyItem: boolean;
  actionHint: string;
}

const GROUP_ORDER: ActionGroup[] = ["before_use", "schedule_soon", "monitor", "complete_data"];

const SEVERITY_WEIGHT: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function groupFor(c: ComponentView): ActionGroup {
  const s = c.diagnosis.status;
  if (s === "action") return "before_use";
  if (s === "attention") return "schedule_soon";
  if (s === "unknown") return "complete_data";
  // OK entra em "Acompanhe" apenas quando existe sinal a observar
  return "monitor";
}

function priorityFor(group: ActionGroup): ActionPriority {
  switch (group) {
    case "before_use": return "critical";
    case "schedule_soon": return "preventive";
    case "monitor": return "monitor";
    case "complete_data": return "informative";
  }
}

function suggestedActionFor(group: ActionGroup, c: ComponentView): RecommendationAction {
  if (group === "complete_data") return "complete_data";
  if (group === "before_use") return "register_maintenance";
  if (group === "schedule_soon") return "schedule_service";
  return "add_inspection";
}

function alternativesFor(group: ActionGroup): RecommendationAction[] {
  if (group === "complete_data") return ["add_inspection", "register_maintenance", "attach_photo", "mark_not_applicable"];
  if (group === "before_use") return ["schedule_service", "add_inspection", "attach_photo", "open_history"];
  if (group === "schedule_soon") return ["register_maintenance", "add_inspection", "mark_resolved", "open_history"];
  return ["attach_photo", "open_history", "mark_not_applicable"];
}

/**
 * Ciclo de vida derivado. Enquanto não houver persistência, a TIL infere:
 * - "resolved" quando houve manutenção recente e o item voltou a ficar OK;
 * - "expired" quando o intervalo já foi ultrapassado;
 * - "open" nos demais casos.
 */
function lifecycleFor(c: ComponentView): RecommendationStatus {
  if (c.diagnosis.status === "action") return "expired";
  if (c.diagnosis.trend === "improving" && c.diagnosis.status === "ok") return "resolved";
  return "open";
}

/** Constrói o plano de ação priorizado a partir dos componentes da moto. */
export function computeActionPlan(components: ComponentView[]): ActionPlanItem[] {
  const items: ActionPlanItem[] = [];

  for (const c of components) {
    if (c.hidden || c.rawStatus === "not_applicable") continue;
    const d = c.diagnosis;
    const group = groupFor(c);

    // "Acompanhe" só recebe itens OK com algum sinal relevante — evita ruído.
    if (group === "monitor") {
      const worthMonitoring = d.isSafetyItem || d.hasConflict || d.trend === "worsening";
      if (!worthMonitoring) continue;
    }

    items.push({
      scheduleId: c.scheduleId,
      title: c.name ?? "Componente",
      category: c.categoryLabel,
      status: d.status,
      group,
      priority: priorityFor(group),
      reason: d.reasons[0] ?? c.statusLabel,
      recommendation: d.conclusion,
      dueEstimateLabel: d.dueEstimateLabel,
      origin: { rules: d.rulesFired, ruleVersion: d.ruleVersion, computedAt: d.computedAt },
      suggestedAction: suggestedActionFor(group, c),
      suggestedActionLabel: RECOMMENDATION_ACTION_LABEL[suggestedActionFor(group, c)],
      alternativeActions: alternativesFor(group),
      lifecycle: lifecycleFor(c),
      confidenceLevel: d.confidence.level,
      isSafetyItem: d.isSafetyItem,
      actionHint: c.actionHint,
    });
  }

  return items.sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    if (g !== 0) return g;
    if (a.isSafetyItem !== b.isSafetyItem) return a.isSafetyItem ? -1 : 1;
    const s = HEALTH_STATUS_WEIGHT[a.status] - HEALTH_STATUS_WEIGHT[b.status];
    if (s !== 0) return s;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
}

/** Resumo curto do plano — usado no Cockpit e no cabeçalho da Saúde. */
export function summarizeActionPlan(plan: ActionPlanItem[]): string {
  const before = plan.filter((i) => i.group === "before_use").length;
  const soon = plan.filter((i) => i.group === "schedule_soon").length;
  const data = plan.filter((i) => i.group === "complete_data").length;

  if (before > 0) {
    return before === 1
      ? "1 item precisa ser verificado antes de rodar"
      : `${before} itens precisam ser verificados antes de rodar`;
  }
  if (soon > 0) {
    return soon === 1 ? "1 manutenção deve ser programada" : `${soon} manutenções devem ser programadas`;
  }
  if (data > 0) {
    return data === 1
      ? "1 componente ainda sem dados suficientes"
      : `${data} componentes ainda sem dados suficientes`;
  }
  return "Nenhuma ação pendente";
}

export { SEVERITY_WEIGHT as ACTION_SEVERITY_WEIGHT, GROUP_ORDER as ACTION_GROUP_ORDER };
