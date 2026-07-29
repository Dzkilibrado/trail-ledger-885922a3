import type { ScheduleStatus } from "@/lib/maintenance-engine";
import { formatDate } from "@/lib/trailbook";
import type { HealthStatus } from "./status";
import { HEALTH_STATUS_LABEL } from "./status";

/**
 * TrailBook Health — Diagnóstico Inteligente (Nível 3).
 *
 * Este módulo responde SEMPRE à pergunta "por que este componente
 * recebeu esse status?" — em linguagem natural, nunca em números soltos.
 *
 * Preparação para IA: `reasons` + `facts` formam o contexto estruturado.
 * Na Fase 2 a redação passa a ser gerada por IA sem alterar o motor.
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
  /** Motivos observados — cada linha é um fato verificável. */
  reasons: string[];
  /** Conclusão objetiva: o que o proprietário deve fazer. */
  conclusion: string;
  /** Saúde estimada (0..100) — uso interno / barra visual. Nunca destacada. */
  healthEstimate: number | null;
  /** Vida útil restante em linguagem natural. */
  lifeRemainingLabel: string;
  lifeRemainingPct: number | null;
  trend: ComponentTrend;
  trendLabel: string;
  nextMaintenanceLabel: string;
  lastMaintenanceLabel: string;
  lastInspectionLabel: string;
  /** Contexto estruturado para futura camada de IA. */
  facts: DiagnosisFact[];
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
}

const INSPECTION_DECISION_LABEL: Record<string, string> = {
  good: "em bom estado",
  attention: "requer atenção",
  replace_recommended: "troca recomendada",
  replaced: "substituído",
  postpone: "adiado",
  ignore: "ignorado",
};

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

function statusFromSchedule(rawStatus: string, s: ScheduleStatus | null): HealthStatus {
  if (rawStatus === "no_info") return "unknown";
  if (!s) return "unknown";
  if (s.status === "overdue") return "action";
  if (s.status === "due" || s.status === "soon") return "attention";
  return "ok";
}

function computeTrend(input: DiagnosisInput): ComponentTrend {
  const { status, lastHistoryAt } = input;
  if (!status) return "unknown";
  if (status.status === "overdue") return "worsening";
  if (lastHistoryAt) {
    const days = (Date.now() - new Date(lastHistoryAt).getTime()) / 86400000;
    if (days <= 45 && status.status === "ok") return "improving";
  }
  if (status.status === "due" || status.status === "soon") return "worsening";
  return "stable";
}

/**
 * Gera o diagnóstico completo de um componente.
 * Pura: mesmas entradas → mesma saída (requisito para o Laudo TrailBook®).
 */
export function computeComponentDiagnosis(input: DiagnosisInput): ComponentDiagnosis {
  const { status: s, rawStatus } = input;

  if (rawStatus === "not_applicable") {
    return {
      status: "unknown",
      statusLabel: "Não se aplica",
      reasons: ["Componente marcado como não aplicável a esta motocicleta."],
      conclusion: "Nenhum acompanhamento é feito para este item.",
      healthEstimate: null,
      lifeRemainingLabel: "Não monitorado",
      lifeRemainingPct: null,
      trend: "unknown",
      trendLabel: TREND_LABEL.unknown,
      nextMaintenanceLabel: "Não se aplica",
      lastMaintenanceLabel: "—",
      lastInspectionLabel: "—",
      facts: [{ key: "not_applicable", value: 1 }],
    };
  }

  const status = statusFromSchedule(rawStatus, s);
  const reasons: string[] = [];
  const facts: DiagnosisFact[] = [];

  // --- Última manutenção ---
  let lastMaintenanceLabel = "Sem registro";
  if (input.lastMaintenance) {
    const parts: string[] = [];
    if (input.lastMaintenance.date) parts.push(formatDate(input.lastMaintenance.date));
    if (input.lastMaintenance.hours != null) parts.push(fmtHours(input.lastMaintenance.hours));
    if (input.lastMaintenance.km != null) parts.push(fmtKm(input.lastMaintenance.km));
    if (parts.length) lastMaintenanceLabel = parts.join(" · ");
    reasons.push(`Última manutenção registrada em ${lastMaintenanceLabel}.`);
    facts.push({ key: "last_maintenance_at", value: input.lastMaintenance.date });
  } else {
    reasons.push("Nenhuma manutenção registrada até o momento.");
  }

  // --- Intervalo previsto ---
  const sch = s?.schedule as Record<string, unknown> | undefined;
  const iv: string[] = [];
  if (sch?.interval_hours != null) iv.push(fmtHours(Number(sch.interval_hours)));
  if (sch?.interval_km != null) iv.push(fmtKm(Number(sch.interval_km)));
  if (sch?.interval_days != null) iv.push(fmtDays(Number(sch.interval_days)));
  if (iv.length) {
    reasons.push(`Intervalo previsto de manutenção: ${iv.join(" ou ")}.`);
    facts.push({ key: "interval", value: iv.join(" | ") });
  }

  // --- Situação atual ---
  let lifeRemainingLabel = "Sem informação";
  let lifeRemainingPct: number | null = null;
  let healthEstimate: number | null = null;
  let nextMaintenanceLabel = "Sem previsão";

  if (s) {
    const progress = Math.max(0, s.progress);
    healthEstimate = Math.max(0, Math.round((1 - Math.min(progress, 1)) * 100));
    lifeRemainingPct = healthEstimate;
    facts.push({ key: "progress", value: Number(progress.toFixed(3)) });

    const phrase = remainingPhrase(s);
    if (s.status === "overdue") {
      lifeRemainingLabel = "Vida útil prevista esgotada";
      nextMaintenanceLabel = phrase ? `Vencida há ${phrase}` : "Vencida";
      reasons.push(phrase
        ? `O intervalo previsto foi ultrapassado em ${phrase}.`
        : "O intervalo previsto de manutenção foi ultrapassado.");
    } else if (phrase) {
      lifeRemainingLabel = `Restam aproximadamente ${phrase}`;
      nextMaintenanceLabel = `Em ${phrase}`;
      reasons.push(`Restam aproximadamente ${phrase} até a manutenção prevista.`);
    } else {
      lifeRemainingLabel = "Dentro do intervalo previsto";
      nextMaintenanceLabel = "Dentro do intervalo previsto";
    }

    if (s.estimatedDueDate) {
      facts.push({ key: "estimated_due_date", value: s.estimatedDueDate.toISOString() });
    }
  } else if (rawStatus === "no_info") {
    reasons.push("Ainda não sabemos quando este item foi feito pela última vez.");
    nextMaintenanceLabel = "Depende da informação da última manutenção";
  }

  // --- Última inspeção ---
  let lastInspectionLabel = "Nunca inspecionado";
  if (input.lastInspection) {
    const dec = INSPECTION_DECISION_LABEL[input.lastInspection.decision] ?? input.lastInspection.decision;
    lastInspectionLabel = `${formatDate(input.lastInspection.at)} · ${dec}`;
    reasons.push(`Na última inspeção o componente foi avaliado como ${dec}.`);
    if (input.lastInspection.notes) reasons.push(`Observação registrada: ${input.lastInspection.notes}.`);
    facts.push({ key: "last_inspection_decision", value: input.lastInspection.decision });
  }

  // --- Severidade ---
  if (input.severity === "critical" || input.severity === "high") {
    reasons.push("Componente classificado como item de segurança / alta importância.");
  }

  if (input.notes) reasons.push(`Anotação do proprietário: ${input.notes}.`);

  facts.push({ key: "history_count", value: input.historyCount });

  // --- Conclusão ---
  let conclusion: string;
  if (status === "action") {
    conclusion = input.severity === "critical" || input.severity === "high"
      ? "Não recomendamos rodar antes de resolver este item."
      : "Resolva este item antes do próximo uso.";
  } else if (status === "attention") {
    conclusion = "Ainda pode ser utilizada normalmente. Programe a manutenção deste componente.";
  } else if (status === "unknown") {
    conclusion = "Informe a última manutenção para que o TrailBook possa acompanhar este componente.";
  } else {
    conclusion = "Nada a fazer agora. Continue acompanhando normalmente.";
  }

  const trend = computeTrend(input);

  return {
    status,
    statusLabel: HEALTH_STATUS_LABEL[status],
    reasons,
    conclusion,
    healthEstimate,
    lifeRemainingLabel,
    lifeRemainingPct,
    trend,
    trendLabel: TREND_LABEL[trend],
    nextMaintenanceLabel,
    lastMaintenanceLabel,
    lastInspectionLabel,
    facts,
  };
}
