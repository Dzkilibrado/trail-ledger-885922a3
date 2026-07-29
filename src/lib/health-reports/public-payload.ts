import type { HealthReportSnapshot, ReportSection } from "./types";

/**
 * Sanitização OBRIGATÓRIA do snapshot antes de sair para o público.
 * Remove dados pessoais e seções não autorizadas — nunca confiar na UI.
 */
export function sanitizePublicSnapshot(
  snapshot: HealthReportSnapshot,
  allowed: ReportSection[],
): Partial<HealthReportSnapshot> {
  const has = (s: ReportSection) => allowed.includes(s);
  const out: Partial<HealthReportSnapshot> = {
    formatVersion: snapshot.formatVersion,
    tilVersion: snapshot.tilVersion,
    ruleVersion: snapshot.ruleVersion,
    issuedAt: snapshot.issuedAt,
    timezone: snapshot.timezone,
    validity: snapshot.validity,
    disclaimer: snapshot.disclaimer,
  };

  if (has("identification")) {
    const m = snapshot.motorcycle;
    out.motorcycle = {
      id: "",
      trailbookId: m.trailbookId,
      nickname: m.nickname,
      brand: m.brand,
      model: m.model,
      yearMake: m.yearMake,
      yearModel: m.yearModel,
      displacement: m.displacement,
      plate: m.plate,
      chassisMasked: m.chassisMasked,
      controlType: m.controlType,
      condition: m.condition,
      hoursTotal: m.hoursTotal,
      kmTotal: m.kmTotal,
      mainPhotoUrl: null,
    };
  }
  if (has("summary")) {
    out.overall = snapshot.overall;
    out.rideAnswer = snapshot.rideAnswer;
    out.nextMaintenance = snapshot.nextMaintenance;
  }
  if (has("components")) out.components = snapshot.components;
  if (has("action_plan")) out.recommendations = snapshot.recommendations;
  if (has("history")) out.history = snapshot.history;
  if (has("indices")) out.indices = snapshot.indices;
  if (has("reservations")) {
    out.reservations = snapshot.reservations;
    out.conflicts = snapshot.conflicts;
    out.missingData = snapshot.missingData;
  }
  // Nunca exportado: owner, issuedBy, ids internos, fotos privadas, fontes internas.
  return out;
}