import { formatDate } from "@/lib/trailbook";
import type { CockpitSnapshot } from "@/lib/til";

export interface ValidityResult {
  validUntil: string | null;
  hoursLimit: number | null;
  kmLimit: number | null;
  reason: string;
  label: string;
}

/**
 * Validade do Laudo — termina no que ocorrer primeiro:
 * data limite, limite de horas, limite de quilometragem,
 * manutenção crítica prevista ou evento relevante posterior.
 */
export function computeValidity(input: {
  snapshot: CockpitSnapshot;
  confidenceLevel: string;
  hoursTotal: number;
  kmTotal: number;
  now?: Date;
}): ValidityResult {
  const { snapshot, confidenceLevel } = input;
  const now = input.now ?? new Date();
  const status = snapshot.rideAnswer.status;

  let days: number;
  let hours: number;
  let km: number;
  let reason: string;

  if (status === "action") {
    days = 15; hours = 10; km = 300;
    reason = "Existem itens que precisam ser resolvidos antes do uso — validade reduzida.";
  } else if (status === "attention") {
    days = 45; hours = 20; km = 800;
    reason = "Existem itens em atenção próximos da manutenção recomendada.";
  } else if (status === "unknown") {
    days = 30; hours = 20; km = 800;
    reason = "A análise ainda depende de dados que não foram informados.";
  } else {
    days = 180; hours = 60; km = 3000;
    reason = "Nenhum item crítico identificado nos registros atuais.";
  }

  if (confidenceLevel === "low" || confidenceLevel === "not_evaluable") {
    days = Math.round(days / 3); hours = Math.round(hours / 2); km = Math.round(km / 2);
    reason += " A confiabilidade da análise é baixa, o que reduz a validade.";
  } else if (confidenceLevel === "medium") {
    days = Math.round(days / 1.5);
    reason += " Alguns registros importantes estão ausentes.";
  }

  // Manutenção crítica prevista antecipa o vencimento.
  const next = snapshot.nextMaintenance;
  if (next && (next.status === "due" || next.status === "overdue")) {
    days = Math.min(days, 15);
    reason += " Há manutenção prevista para o curto prazo.";
  }

  const until = new Date(now.getTime() + days * 86400000);
  const hoursLimit = Math.round((input.hoursTotal + hours) * 10) / 10;
  const kmLimit = Math.round(input.kmTotal + km);

  return {
    validUntil: until.toISOString(),
    hoursLimit,
    kmLimit,
    reason,
    label: `Válido até ${formatDate(until.toISOString())} ou por mais ${hours} horas de uso, o que ocorrer primeiro.`,
  };
}

export type EffectiveValidity =
  | { status: "valid"; label: string }
  | { status: "expiring"; label: string }
  | { status: "outdated"; label: string }
  | { status: "superseded"; label: string }
  | { status: "revoked"; label: string };

/** Situação efetiva do laudo considerando data, uso atual e eventos posteriores. */
export function effectiveValidity(report: {
  status: string;
  valid_until: string | null;
  valid_hours_limit: number | null;
  valid_km_limit: number | null;
  outdated_reason?: string | null;
}, current?: { hours: number | null; km: number | null }): EffectiveValidity {
  if (report.status === "revoked") return { status: "revoked", label: "Laudo revogado" };
  if (report.status === "superseded") return { status: "superseded", label: "Substituído por um laudo mais recente" };
  if (report.status === "outdated") {
    return { status: "outdated", label: report.outdated_reason || "Desatualizado após evento relevante" };
  }
  if (current?.hours != null && report.valid_hours_limit != null && current.hours > report.valid_hours_limit) {
    return { status: "outdated", label: "Limite de horas de uso da validade foi ultrapassado" };
  }
  if (current?.km != null && report.valid_km_limit != null && current.km > report.valid_km_limit) {
    return { status: "outdated", label: "Limite de quilometragem da validade foi ultrapassado" };
  }
  if (report.valid_until) {
    const until = new Date(report.valid_until).getTime();
    const now = Date.now();
    if (now > until) return { status: "outdated", label: `Vencido em ${formatDate(report.valid_until)}` };
    if (until - now < 10 * 86400000) {
      return { status: "expiring", label: `Vence em ${formatDate(report.valid_until)}` };
    }
    return { status: "valid", label: `Válido até ${formatDate(report.valid_until)}` };
  }
  return { status: "valid", label: "Válido" };
}