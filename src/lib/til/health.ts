import { computeConservation } from "@/lib/conservation";
import type { ScheduleStatus } from "@/lib/maintenance-engine";
import type { HealthSnapshot, HealthGrade, HealthBuckets, EventRow, Attachment, Moto } from "./types";
import { HEALTH_GRADE_LABEL } from "./types";
import { HEALTH_STATUS_LABEL, HEALTH_STATUS_MEANING, worstStatus, type HealthStatus } from "./status";
import { RIDE_ANSWER_MESSAGE } from "./messages";
import type { ComponentView } from "./components";

const SEVERITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function bucketize(components: ComponentView[]): HealthBuckets {
  const ok: ComponentView[] = [];
  const attention: ComponentView[] = [];
  const overdue: ComponentView[] = [];
  const noInfo: ComponentView[] = [];
  for (const c of components) {
    if (c.hidden || c.tone === "not_applicable") continue;
    if (c.tone === "critical") overdue.push(c);
    else if (c.tone === "attention") attention.push(c);
    else if (c.tone === "no_info") noInfo.push(c);
    else ok.push(c);
  }
  const bySeverityThenName = (a: ComponentView, b: ComponentView) => {
    const w = (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0);
    return w !== 0 ? w : a.name.localeCompare(b.name);
  };
  overdue.sort(bySeverityThenName);
  attention.sort(bySeverityThenName);
  return { ok, attention, overdue, noInfo };
}

/**
 * Regra do diagnóstico geral (grade):
 * - critical  → qualquer componente VENCIDO, ou "atenção" com severidade alta/crítica
 * - attention → qualquer componente em atenção (sem vencidos)
 * - excellent → sem vencidos, sem atenção, e sem sem-informação
 * - good      → sem vencidos, sem atenção, mas há sem-informação
 */
function computeGrade(b: HealthBuckets): HealthGrade {
  if (b.overdue.length > 0) return "critical";
  const highAtt = b.attention.some((c) => c.severity === "high" || c.severity === "critical");
  if (highAtt) return "critical";
  if (b.attention.length > 0) return "attention";
  if (b.noInfo.length > 0) return "good";
  return "excellent";
}

function headlineFor(grade: HealthGrade, b: HealthBuckets): string {
  if (grade === "critical") {
    const n = b.overdue.length || b.attention.length;
    return n === 1 ? "1 item precisa ser resolvido antes de rodar" : `${n} itens precisam ser resolvidos`;
  }
  if (grade === "attention") return "Alguns componentes merecem atenção";
  if (grade === "excellent") return "Pronta para uso";
  return "Pronta para uso — alguns componentes ainda sem informação";
}

/**
 * Índice de saúde da moto (0..100) + frase única + tom visual.
 * Reutiliza a lógica canônica de conservação — telas nunca calculam.
 */
export function computeHealth(input: {
  moto: Pick<Moto, "plate" | "renavam" | "chassis">;
  events: EventRow[];
  attachments: Attachment[];
  statuses: ScheduleStatus[];
  workshopEventIds: Set<string>;
  components: ComponentView[];
}): HealthSnapshot {
  const c = computeConservation({
    events: input.events,
    attachments: input.attachments,
    statuses: input.statuses,
    workshopEventIds: input.workshopEventIds,
    hasDocs: {
      plate: !!input.moto.plate,
      renavam: !!input.moto.renavam,
      chassis: !!input.moto.chassis,
    },
  });
  const score = c.score;
  const buckets = bucketize(input.components);
  const grade = computeGrade(buckets);
  const tone: HealthSnapshot["tone"] = grade === "critical" ? "bad" : grade === "attention" ? "warn" : "good";
  const label =
    grade === "excellent" ? "Sua moto está impecável" :
    grade === "good"      ? "Sua moto está em boa forma" :
    grade === "attention" ? "Sua moto pede atenção" :
                            "Sua moto precisa de cuidados";
  const topAttention = buckets.overdue[0] ?? buckets.attention[0] ?? null;

  // Linguagem oficial de status — o usuário nunca interpreta números.
  const status: HealthStatus = worstStatus(
    input.components
      .filter((c) => !c.hidden && c.tone !== "not_applicable")
      .map((c) => c.diagnosis.status),
  );
  const canRideAnswer =
    status === "action" && topAttention
      ? `${RIDE_ANSWER_MESSAGE.action} Comece por ${topAttention.name}.`
      : RIDE_ANSWER_MESSAGE[status];

  return {
    score, tone, label,
    grade,
    gradeLabel: HEALTH_GRADE_LABEL[grade],
    headline: headlineFor(grade, buckets),
    buckets,
    topAttention,
    status,
    statusLabel: HEALTH_STATUS_LABEL[status],
    statusMeaning: HEALTH_STATUS_MEANING[status],
    canRideAnswer,
  };
}