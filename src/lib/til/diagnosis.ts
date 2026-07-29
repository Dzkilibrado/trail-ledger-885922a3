import type { ScheduleStatus } from "@/lib/maintenance-engine";
import { formatDate } from "@/lib/trailbook";
import type { HealthStatus } from "./status";
import { HEALTH_STATUS_LABEL } from "./status";
import {
  DIAGNOSIS_RULE_VERSION,
  STATUS_CONCLUSION,
  STATUS_CONCLUSION_SAFETY,
  STATUS_MEANING_TEXT,
  STATUS_TITLE,
  STATUS_WHY_TITLE,
} from "./messages";
import { computeConfidence, type ConfidenceAssessment } from "./confidence";

/**
 * TrailBook Health — Diagnóstico Inteligente (fonte única da verdade).
 *
 * Responde sempre, para cada componente:
 *   1. qual o status;
 *   2. por que chegamos a ele (motivos rastreáveis);
 *   3. o que significa;
 *   4. o que fazer;
 *   5. quais dados foram usados e quais faltam;
 *   6. quanto o diagnóstico é confiável.
 *
 * Regras invioláveis:
 *   - ausência de dados NUNCA vira "OK";
 *   - item de segurança com sinal adverso NUNCA fica verde;
 *   - alerta de segurança tem prioridade sobre estimativa de vida útil;
 *   - dados conflitantes reduzem a confiabilidade e nunca assumem cenário seguro.
 *
 * A pontuação interna (`internalScore`) é preservada apenas como mecanismo
 * técnico de cálculo e auditoria — nunca é exibida isoladamente ao usuário.
 */

export type ComponentTrend = "improving" | "stable" | "worsening" | "unknown";

export const TREND_LABEL: Record<ComponentTrend, string> = {
  improving: "Melhorando",
  stable: "Estável",
  worsening: "Piorando",
  unknown: "Sem tendência",
};

export interface DiagnosisFact {
  key: string;
  value: string | number | null;
}

export interface ComponentDiagnosis {
  status: HealthStatus;
  statusLabel: string;
  /** Título curto exibido em listas ("OK", "Atenção", "Ainda não avaliado"). */
  statusTitle: string;
  /** Cabeçalho da explicação ("Por que está em atenção?"). */
  whyTitle: string;
  /** Frase semântica oficial do status (catálogo central). */
  meaning: string;
  /** Motivos observados — cada linha é um fato verificável. */
  reasons: string[];
  /** Conclusão objetiva: o que o proprietário deve fazer. */
  conclusion: string;
  /** Confiabilidade da análise (independente do estado do componente). */
  confidence: ConfidenceAssessment;
  /** Vida útil restante em linguagem natural. */
  lifeRemainingLabel: string;
  lifeRemainingPct: number | null;
  /** Prazo estimado para a ação ("antes do próximo uso", "em ~12 h de uso"). */
  dueEstimateLabel: string;
  trend: ComponentTrend;
  trendLabel: string;
  nextMaintenanceLabel: string;
  lastMaintenanceLabel: string;
  lastInspectionLabel: string;
  /** É item de segurança (alta/crítica). */
  isSafetyItem: boolean;
  /** Dados conflitantes detectados. */
  hasConflict: boolean;
  /** Regras acionadas — auditoria técnica / painel admin. */
  rulesFired: string[];
  /** Pontuação interna 0..100 (uso técnico; nunca exibida isoladamente). */
  internalScore: number | null;
  /** Versão do algoritmo aplicado. */
  ruleVersion: string;
  /** Momento do processamento. */
  computedAt: string;
  /** Contexto estruturado para futura camada de IA. */
  facts: DiagnosisFact[];
  /** @deprecated use `internalScore` — mantido para compatibilidade interna. */
  healthEstimate: number | null;
}

export interface DiagnosisInput {
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  rawStatus: string;
  status: ScheduleStatus | null;
  lastMaintenance: { date: string | null; hours: number | null; km: number | null } | null;
  historyCount: number;
  lastHistoryAt: string | null;
  lastInspection: { at: string; decision: string; notes: string | null } | null;
  notes: string | null;
  /** Leituras atuais da moto — usadas para detectar conflitos. */
  usage?: { hours: number | null; km: number | null } | null;
  /** Tem foto/evidência anexada ao componente. */
  hasPhotoEvidence?: boolean;
  /** Alguma manutenção deste componente foi feita em oficina. */
  hasWorkshopRecord?: boolean;
}

const INSPECTION_DECISION_LABEL: Record<string, string> = {
  good: "em bom estado",
  attention: "requer atenção",
  replace_recommended: "troca recomendada",
  replaced: "substituído",
  postpone: "adiado",
  ignore: "ignorado",
};

/** Decisões de inspeção que representam sinal adverso confirmado. */
const ADVERSE_DECISIONS = new Set(["attention", "replace_recommended"]);
const RESOLVED_DECISIONS = new Set(["replaced"]);

function fmtHours(n: number): string {
  return `${n.toFixed(1).replace(/\.0$/, "")} h`;
}
function fmtKm(n: number): string {
  return `${Math.round(n).toLocaleString("pt-BR")} km`;
}
function fmtDays(n: number): string {
  const d = Math.round(Math.abs(n));
  return d === 1 ? "1 dia" : `${d} dias`;
}

function remainingPhrase(s: ScheduleStatus): string | null {
  const r = s.remaining;
  if (s.drivenBy === "hours" && r.hours != null) return fmtHours(Math.abs(r.hours));
  if (s.drivenBy === "km" && r.km != null) return fmtKm(Math.abs(r.km));
  if (s.drivenBy === "days" && r.days != null) return fmtDays(r.days);
  if (r.hours != null) return fmtHours(Math.abs(r.hours));
  if (r.km != null) return fmtKm(Math.abs(r.km));
  if (r.days != null) return fmtDays(r.days);
  return null;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86400000;
}

function detectConflict(input: DiagnosisInput): string | null {
  const lm = input.lastMaintenance;
  if (!lm) return null;
  const usage = input.usage ?? null;
  if (lm.date && new Date(lm.date).getTime() > Date.now() + 86400000) {
    return "A data da última manutenção está no futuro.";
  }
  if (usage?.hours != null && lm.hours != null && lm.hours > Number(usage.hours) + 0.5) {
    return "A leitura de horas da última manutenção é maior que o horímetro atual da moto.";
  }
  if (usage?.km != null && lm.km != null && lm.km > Number(usage.km) + 1) {
    return "A quilometragem da última manutenção é maior que o odômetro atual da moto.";
  }
  return null;
}

function computeTrend(input: DiagnosisInput, adverse: boolean, recentlyReplaced: boolean): ComponentTrend {
  const { status } = input;
  if (recentlyReplaced) return "improving";
  if (adverse) return "worsening";
  if (!status) return "unknown";
  if (status.status === "overdue") return "worsening";
  const d = daysSince(input.lastHistoryAt);
  if (d != null && d <= 45 && status.status === "ok") return "improving";
  if (status.status === "due" || status.status === "soon") return "worsening";
  return "stable";
}

/**
 * Gera o diagnóstico completo de um componente.
 * Função pura: mesmas entradas → mesma saída (requisito do Laudo TrailBook®).
 */
export function computeComponentDiagnosis(input: DiagnosisInput): ComponentDiagnosis {
  const { status: s, rawStatus } = input;
  const computedAt = new Date().toISOString();
  const isSafetyItem = input.severity === "critical" || input.severity === "high";

  if (rawStatus === "not_applicable") {
    return {
      status: "unknown",
      statusLabel: "Não se aplica",
      statusTitle: "Não se aplica",
      whyTitle: "Por que não é monitorado?",
      meaning: "Este componente foi marcado como não aplicável a esta motocicleta.",
      reasons: ["Componente marcado como não aplicável a esta motocicleta."],
      conclusion: "Nenhum acompanhamento é feito para este item.",
      confidence: computeConfidence({ evaluable: false, usedKeys: [], missingKeys: [], daysSinceLastRecord: null }),
      lifeRemainingLabel: "Não monitorado",
      lifeRemainingPct: null,
      dueEstimateLabel: "Não se aplica",
      trend: "unknown",
      trendLabel: TREND_LABEL.unknown,
      nextMaintenanceLabel: "Não se aplica",
      lastMaintenanceLabel: "—",
      lastInspectionLabel: "—",
      isSafetyItem,
      hasConflict: false,
      rulesFired: ["not_applicable"],
      internalScore: null,
      ruleVersion: DIAGNOSIS_RULE_VERSION,
      computedAt,
      facts: [{ key: "not_applicable", value: 1 }],
      healthEstimate: null,
    };
  }

  const reasons: string[] = [];
  const facts: DiagnosisFact[] = [];
  const rulesFired: string[] = [];
  const usedKeys: string[] = [];
  const missingKeys: string[] = [];

  // ---------------------------------------------------------------- dados
  const inspection = input.lastInspection;
  const adverseInspection = !!inspection && ADVERSE_DECISIONS.has(inspection.decision);
  const recentlyReplaced =
    (!!inspection && RESOLVED_DECISIONS.has(inspection.decision) && (daysSince(inspection.at) ?? 999) <= 60) ||
    ((daysSince(input.lastHistoryAt) ?? 999) <= 30 && (s?.status === "ok"));

  const conflictMessage = detectConflict(input);
  const hasConflict = !!conflictMessage;
  if (hasConflict) rulesFired.push("data_conflict");

  // ---------------------------------------------------- status determinado
  let status: HealthStatus;
  if (rawStatus === "no_info" || !s) {
    status = "unknown";
    rulesFired.push("no_baseline_information");
  } else if (s.status === "overdue") {
    status = "action";
    rulesFired.push("interval_exceeded");
  } else if (s.status === "due" || s.status === "soon") {
    status = "attention";
    rulesFired.push("interval_approaching");
  } else {
    status = "ok";
    rulesFired.push("within_interval");
  }

  // Prioridade absoluta: sinal de segurança acima de estimativa de vida útil.
  if (adverseInspection) {
    const forced: HealthStatus =
      inspection!.decision === "replace_recommended" || isSafetyItem ? "action" : "attention";
    if (forced === "action" || status === "ok" || status === "unknown") {
      status = forced === "action" ? "action" : status === "ok" || status === "unknown" ? "attention" : status;
    }
    rulesFired.push("adverse_inspection_override");
  }

  // Item de segurança sem qualquer informação nunca aparece como OK.
  if (isSafetyItem && status === "ok" && !input.lastMaintenance && input.historyCount === 0) {
    status = "attention";
    rulesFired.push("safety_item_without_history");
  }

  // Dados conflitantes: nunca assumir cenário seguro.
  if (hasConflict && status === "ok") {
    status = "attention";
    rulesFired.push("conflict_prevents_ok");
  }

  // --------------------------------------------------------- última manut.
  let lastMaintenanceLabel = "Sem registro";
  if (input.lastMaintenance) {
    const parts: string[] = [];
    if (input.lastMaintenance.date) parts.push(formatDate(input.lastMaintenance.date));
    if (input.lastMaintenance.hours != null) parts.push(fmtHours(input.lastMaintenance.hours));
    if (input.lastMaintenance.km != null) parts.push(fmtKm(input.lastMaintenance.km));
    if (parts.length) lastMaintenanceLabel = parts.join(" · ");
    reasons.push(`Última manutenção registrada em ${lastMaintenanceLabel}.`);
    usedKeys.push("last_maintenance");
    facts.push({ key: "last_maintenance_at", value: input.lastMaintenance.date });
  } else {
    reasons.push("Nenhuma manutenção registrada até o momento.");
    missingKeys.push("last_maintenance");
  }

  if (input.historyCount > 0) usedKeys.push("history");
  else missingKeys.push("history");

  // ------------------------------------------------------------- intervalo
  const sch = s?.schedule as Record<string, unknown> | undefined;
  const iv: string[] = [];
  if (sch?.interval_hours != null) iv.push(fmtHours(Number(sch.interval_hours)));
  if (sch?.interval_km != null) iv.push(fmtKm(Number(sch.interval_km)));
  if (sch?.interval_days != null) iv.push(fmtDays(Number(sch.interval_days)));
  if (iv.length) {
    reasons.push(`O intervalo de referência informado é de ${iv.join(" ou ")}.`);
    usedKeys.push("reference_interval");
    facts.push({ key: "interval", value: iv.join(" | ") });
  } else {
    missingKeys.push("reference_interval");
    rulesFired.push("missing_manufacturer_schedule");
  }

  if (input.usage?.hours != null || input.usage?.km != null) usedKeys.push("current_usage");
  else missingKeys.push("current_usage");

  // ------------------------------------------------------- situação atual
  let lifeRemainingLabel = "Sem informação";
  let lifeRemainingPct: number | null = null;
  let internalScore: number | null = null;
  let nextMaintenanceLabel = "Sem previsão";
  let dueEstimateLabel = "Sem prazo definido";

  if (s) {
    const progress = Math.max(0, s.progress);
    internalScore = Math.max(0, Math.round((1 - Math.min(progress, 1)) * 100));
    lifeRemainingPct = internalScore;
    facts.push({ key: "progress", value: Number(progress.toFixed(3)) });

    const phrase = remainingPhrase(s);
    if (s.status === "overdue") {
      lifeRemainingLabel = "Vida útil prevista esgotada";
      nextMaintenanceLabel = phrase ? `Vencida há ${phrase}` : "Vencida";
      dueEstimateLabel = "Antes do próximo uso";
      reasons.push(phrase
        ? `O intervalo previsto foi ultrapassado em ${phrase}.`
        : "O intervalo previsto de manutenção foi ultrapassado.");
    } else if (phrase) {
      lifeRemainingLabel = `Restam aproximadamente ${phrase}`;
      nextMaintenanceLabel = `Em ${phrase}`;
      dueEstimateLabel = status === "attention" ? `Nas próximas ${phrase} de uso` : `Em aproximadamente ${phrase}`;
      reasons.push(`Restam aproximadamente ${phrase} até a manutenção prevista.`);
    } else {
      lifeRemainingLabel = "Dentro do intervalo previsto";
      nextMaintenanceLabel = "Dentro do intervalo previsto";
      dueEstimateLabel = "Sem prazo imediato";
    }

    if (s.estimatedDueDate) facts.push({ key: "estimated_due_date", value: s.estimatedDueDate.toISOString() });
  } else {
    reasons.push("Ainda não sabemos quando este item foi feito pela última vez.");
    nextMaintenanceLabel = "Depende da informação da última manutenção";
    dueEstimateLabel = "Sem prazo — dados insuficientes";
  }

  // ------------------------------------------------------ última inspeção
  let lastInspectionLabel = "Nunca inspecionado";
  if (inspection) {
    const dec = INSPECTION_DECISION_LABEL[inspection.decision] ?? inspection.decision;
    lastInspectionLabel = `${formatDate(inspection.at)} · ${dec}`;
    reasons.push(`Na última inspeção o componente foi avaliado como ${dec}.`);
    if (inspection.notes) reasons.push(`Ocorrência informada: ${inspection.notes}.`);
    usedKeys.push("inspection");
    if (inspection.notes) usedKeys.push("occurrences");
    facts.push({ key: "last_inspection_decision", value: inspection.decision });
  } else {
    missingKeys.push("inspection");
  }

  if (recentlyReplaced) {
    reasons.push("Existe registro recente de substituição ou manutenção deste componente.");
    rulesFired.push("recent_replacement");
  }

  if (hasConflict) {
    reasons.push(`${conflictMessage} Recomendamos conferir os dados informados.`);
  }

  if (isSafetyItem) {
    reasons.push("Componente classificado como item de segurança / alta importância.");
    rulesFired.push("safety_item");
  }

  if (input.notes) reasons.push(`Anotação do proprietário: ${input.notes}.`);

  if (input.hasPhotoEvidence) usedKeys.push("photo");
  else missingKeys.push("photo");
  if (input.hasWorkshopRecord) usedKeys.push("workshop");
  else missingKeys.push("workshop");

  facts.push({ key: "history_count", value: input.historyCount });
  facts.push({ key: "severity", value: input.severity });

  // ------------------------------------------------------------- conclusão
  let conclusion = STATUS_CONCLUSION[status];
  if (status === "action" && isSafetyItem) conclusion = STATUS_CONCLUSION_SAFETY;
  if (status === "attention" && s && remainingPhrase(s)) {
    conclusion = `Programe uma inspeção antes de completar mais ${remainingPhrase(s)} de uso.`;
  }

  const confidence = computeConfidence({
    evaluable: status !== "unknown",
    usedKeys: Array.from(new Set(usedKeys)),
    missingKeys: Array.from(new Set(missingKeys)),
    daysSinceLastRecord: daysSince(input.lastHistoryAt ?? input.lastMaintenance?.date ?? null),
    hasConflict,
  });

  const trend = computeTrend(input, adverseInspection, recentlyReplaced);

  return {
    status,
    statusLabel: HEALTH_STATUS_LABEL[status],
    statusTitle: STATUS_TITLE[status],
    whyTitle: STATUS_WHY_TITLE[status],
    meaning: STATUS_MEANING_TEXT[status],
    reasons,
    conclusion,
    confidence,
    lifeRemainingLabel,
    lifeRemainingPct,
    dueEstimateLabel,
    trend,
    trendLabel: TREND_LABEL[trend],
    nextMaintenanceLabel,
    lastMaintenanceLabel,
    lastInspectionLabel,
    isSafetyItem,
    hasConflict,
    rulesFired,
    internalScore,
    ruleVersion: DIAGNOSIS_RULE_VERSION,
    computedAt,
    facts,
    healthEstimate: internalScore,
  };
}
