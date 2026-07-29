import { CONFIDENCE_LABEL, type CockpitSnapshot } from "@/lib/til";
import { ACTION_GROUP_LABEL } from "@/lib/til/action-plan";
import { DIAGNOSIS_RULE_VERSION } from "@/lib/til/messages";
import { HEALTH_STATUS_LABEL } from "@/lib/til/status";
import { EVENT_TYPE_LABEL, type EventRow, type Motorcycle } from "@/lib/trailbook";
import {
  REPORT_DISCLAIMER,
  REPORT_FORMAT_VERSION,
  TIL_VERSION,
  type HealthReportSnapshot,
} from "./types";
import type { ValidityResult } from "./validity";

function maskChassis(chassis: string | null): string | null {
  if (!chassis) return null;
  const v = chassis.trim();
  if (v.length <= 6) return v;
  return `${v.slice(0, 3)}${"*".repeat(Math.max(0, v.length - 7))}${v.slice(-4)}`;
}

const CONFIDENCE_EXPLANATION: Record<string, string> = {
  high: "Existem registros suficientes, recentes e consistentes.",
  medium: "A análise é possível, mas faltam alguns registros importantes.",
  low: "Existem poucos dados ou as informações estão desatualizadas.",
  not_evaluable: "Não há informações suficientes para avaliar a moto.",
};

/**
 * Fotografia imutável da análise no momento da emissão.
 * Nunca deve depender das tabelas atuais para ser reconstruída.
 */
export function buildReportSnapshot(input: {
  moto: Motorcycle;
  snapshot: CockpitSnapshot;
  events: EventRow[];
  inspections: Array<{ created_at: string; decision: string; notes: string | null }>;
  issuedBy: { id: string; name: string | null };
  owner: { id: string; name: string | null };
  confidenceLevel: string;
  reservations: string[];
  conflicts: string[];
  missingData: string[];
  validity: ValidityResult;
  issuedAt?: string;
}): HealthReportSnapshot {
  const { moto, snapshot } = input;
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const evaluated = snapshot.components.filter((c) => !c.hidden && c.tone !== "not_applicable");

  const maintenanceEvents = input.events
    .filter((e) => e.type === "maintenance" || e.type === "revision")
    .slice(0, 10)
    .map((e) => ({ date: e.occurred_at, title: e.title, type: EVENT_TYPE_LABEL[e.type] ?? e.type }));

  const incidents = input.events
    .filter((e) => e.type === "incident")
    .slice(0, 10)
    .map((e) => ({ date: e.occurred_at, title: e.title }));

  return {
    formatVersion: REPORT_FORMAT_VERSION,
    tilVersion: TIL_VERSION,
    ruleVersion: DIAGNOSIS_RULE_VERSION,
    issuedAt,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    issuedBy: input.issuedBy,
    owner: input.owner,
    motorcycle: {
      id: moto.id,
      trailbookId: (moto as any).trailbook_id ?? "",
      nickname: moto.nickname ?? null,
      brand: moto.brand,
      model: moto.model,
      yearMake: moto.year_make ?? null,
      yearModel: moto.year_model ?? null,
      displacement: moto.displacement ?? null,
      plate: moto.plate ?? null,
      chassisMasked: maskChassis(moto.chassis ?? null),
      controlType: moto.control_type,
      condition: (moto as any).condition ?? "",
      hoursTotal: Number(moto.hours_total ?? 0),
      kmTotal: Number(moto.km_total ?? 0),
      mainPhotoUrl: moto.main_photo_url ?? null,
    },
    overall: {
      status: snapshot.health.status,
      statusLabel: snapshot.health.statusLabel,
      grade: snapshot.health.grade,
      gradeLabel: snapshot.health.gradeLabel,
      headline: snapshot.health.headline,
      conservationIndex: snapshot.health.score,
    },
    rideAnswer: {
      status: snapshot.rideAnswer.status,
      title: snapshot.rideAnswer.title,
      message: snapshot.rideAnswer.message,
      rationale: snapshot.rideAnswer.rationale,
      counts: snapshot.rideAnswer.counts,
      disclaimer: snapshot.rideAnswer.disclaimer,
    },
    components: evaluated.map((c) => ({
      scheduleId: c.scheduleId,
      name: c.name,
      category: c.category,
      categoryLabel: c.categoryLabel,
      status: c.diagnosis.status,
      statusLabel: HEALTH_STATUS_LABEL[c.diagnosis.status],
      severity: c.severity,
      conclusion: c.diagnosis.conclusion,
      reasons: c.diagnosis.reasons,
      trend: c.diagnosis.trend,
      trendLabel: c.diagnosis.trendLabel,
      lifeRemainingLabel: c.diagnosis.lifeRemainingLabel,
      lifeRemainingPct: c.diagnosis.lifeRemainingPct,
      nextAction: c.actionHint,
      dueEstimateLabel: c.diagnosis.dueEstimateLabel,
      confidenceLevel: c.diagnosis.confidence.level,
      confidenceLabel: c.diagnosis.confidence.label,
      missingData: c.diagnosis.confidence.missing.map((m) => m.label),
      hasConflict: c.diagnosis.hasConflict,
      isSafetyItem: c.diagnosis.isSafetyItem,
      remainingLabel: c.statusLabel,
      rulesFired: c.diagnosis.rulesFired,
    })),
    recommendations: snapshot.actionPlan.map((a) => ({
      scheduleId: a.scheduleId,
      group: a.group,
      groupLabel: ACTION_GROUP_LABEL[a.group],
      title: a.title,
      recommendation: a.recommendation,
      status: a.status,
      lifecycle: a.lifecycle,
      dueEstimateLabel: a.dueEstimateLabel,
      isSafetyItem: a.isSafetyItem,
    })),
    nextMaintenance: snapshot.nextMaintenance
      ? {
          name: snapshot.nextMaintenance.name,
          remainingLabel: snapshot.nextMaintenance.remainingLabel,
          status: snapshot.nextMaintenance.status,
        }
      : null,
    history: {
      lastMaintenances: maintenanceEvents,
      lastInspections: input.inspections.slice(0, 10).map((i) => ({
        date: i.created_at,
        decision: i.decision,
        notes: i.notes,
      })),
      incidents,
      totalEvents: input.events.length,
    },
    indices: {
      conservation: snapshot.health.score,
      conservationExplanation:
        "O Índice de Conservação considera regularidade dos registros, evidências anexadas, manutenções em oficina e documentação da moto.",
      confidenceLevel: input.confidenceLevel,
      confidenceLabel: CONFIDENCE_LABEL[input.confidenceLevel as keyof typeof CONFIDENCE_LABEL] ?? input.confidenceLevel,
      confidenceExplanation: CONFIDENCE_EXPLANATION[input.confidenceLevel] ?? "",
    },
    reservations: input.reservations,
    conflicts: input.conflicts,
    missingData: input.missingData,
    dataSources: [
      "Cadastro da motocicleta",
      "Linha do tempo de atividades",
      "Plano de manutenção e componentes",
      "Inspeções registradas",
      "Documentos e evidências anexadas",
    ],
    validity: {
      validUntil: input.validity.validUntil,
      hoursLimit: input.validity.hoursLimit,
      kmLimit: input.validity.kmLimit,
      reason: input.validity.reason,
      label: input.validity.label,
    },
    disclaimer: REPORT_DISCLAIMER,
  };
}

/** JSON canônico (chaves ordenadas) — base do hash de integridade. */
export function canonicalJson(value: unknown): string {
  const sort = (v: any): any => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.keys(v).sort().reduce((acc: any, k) => { acc[k] = sort(v[k]); return acc; }, {});
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

/** Hash de integridade do snapshot (uso interno de validação — não é assinatura digital). */
export async function snapshotHash(snapshot: HealthReportSnapshot): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(snapshot));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}