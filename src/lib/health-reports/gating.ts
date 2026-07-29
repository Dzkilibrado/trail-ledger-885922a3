import type { CockpitSnapshot } from "@/lib/til";
import type { Motorcycle } from "@/lib/trailbook";

export type EmissionMode = "normal" | "with_reservations" | "blocked";

export interface EmissionCheck {
  mode: EmissionMode;
  blockers: Array<{ code: string; title: string; fix: string }>;
  reservations: string[];
  conflicts: string[];
  missingData: string[];
  confidenceLevel: string;
}

const CONF_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, not_evaluable: 0 };

/** Confiabilidade agregada da análise (nível laudo). */
export function aggregateConfidence(snapshot: CockpitSnapshot): string {
  const evaluated = snapshot.components.filter((c) => !c.hidden && c.tone !== "not_applicable");
  if (evaluated.length === 0) return "not_evaluable";
  const avg =
    evaluated.reduce((acc, c) => acc + (CONF_WEIGHT[c.diagnosis.confidence.level] ?? 0), 0) / evaluated.length;
  if (avg >= 2.5) return "high";
  if (avg >= 1.5) return "medium";
  if (avg > 0.4) return "low";
  return "not_evaluable";
}

/**
 * Condições de emissão do Laudo.
 * Um item vermelho NÃO bloqueia: ele consta no laudo com recomendação.
 */
export function checkEmission(input: {
  moto: Motorcycle;
  snapshot: CockpitSnapshot | null;
  maxRecordedHours: number | null;
  maxRecordedKm: number | null;
}): EmissionCheck {
  const { moto, snapshot } = input;
  const blockers: EmissionCheck["blockers"] = [];
  const reservations: string[] = [];
  const conflicts: string[] = [];
  const missingData: string[] = [];

  if (!snapshot) {
    blockers.push({
      code: "til_failed",
      title: "Não foi possível processar a análise",
      fix: "Recarregue a página e tente novamente. Se persistir, abra um chamado na Central de Atendimento.",
    });
    return { mode: "blocked", blockers, reservations, conflicts, missingData, confidenceLevel: "not_evaluable" };
  }

  const hasIdentification = !!(moto.chassis || moto.plate || moto.renavam);
  if (!hasIdentification) {
    blockers.push({
      code: "no_identification",
      title: "Motocicleta sem identificação mínima",
      fix: "Informe placa, chassi ou Renavam no cadastro da moto.",
    });
  }

  const evaluated = snapshot.components.filter((c) => !c.hidden && c.tone !== "not_applicable");
  if (evaluated.length === 0) {
    blockers.push({
      code: "no_components",
      title: "Nenhum componente disponível para análise",
      fix: "Revise o plano de manutenção da moto para habilitar os componentes.",
    });
  }

  const hours = Number(moto.hours_total ?? 0);
  const km = Number(moto.km_total ?? 0);
  if (input.maxRecordedHours != null && hours + 0.01 < input.maxRecordedHours) {
    blockers.push({
      code: "hours_regression",
      title: "Horas atuais menores que um registro anterior",
      fix: `O último registro aponta ${input.maxRecordedHours} h, mas a moto está com ${hours} h. Corrija a leitura do horímetro antes de emitir.`,
    });
  }
  if (input.maxRecordedKm != null && km + 0.01 < input.maxRecordedKm) {
    blockers.push({
      code: "km_regression",
      title: "Quilometragem atual menor que um registro anterior",
      fix: `O último registro aponta ${input.maxRecordedKm} km, mas a moto está com ${km} km. Corrija a leitura do odômetro antes de emitir.`,
    });
  }

  // Ressalvas
  const confidenceLevel = aggregateConfidence(snapshot);
  if (confidenceLevel === "medium") reservations.push("A confiabilidade geral da análise é média: alguns registros importantes estão ausentes.");
  if (confidenceLevel === "low") reservations.push("A confiabilidade geral da análise é baixa: existem poucos dados ou informações desatualizadas.");
  if (confidenceLevel === "not_evaluable") reservations.push("Não há dados suficientes para avaliar a maior parte dos componentes.");

  const unknown = evaluated.filter((c) => c.diagnosis.status === "unknown");
  if (unknown.length > 0) {
    reservations.push(`${unknown.length} componente(s) sem informação suficiente para diagnóstico.`);
    for (const c of unknown) missingData.push(`${c.name}: ${c.diagnosis.confidence.bestNextAction ?? "informe a última manutenção"}`);
  }

  for (const c of evaluated) {
    if (c.diagnosis.hasConflict) conflicts.push(`${c.name}: informações conflitantes entre horas, quilometragem e datas.`);
  }
  if (conflicts.length > 0) reservations.push("Foram detectadas informações conflitantes em um ou mais componentes.");

  const last = snapshot.stats.lastActivityAt ? new Date(snapshot.stats.lastActivityAt).getTime() : null;
  if (last != null && Date.now() - last > 365 * 86400000) {
    reservations.push("O registro de atividade mais recente tem mais de um ano.");
  }
  if (!last) reservations.push("Nenhuma atividade registrada até o momento.");

  const mode: EmissionMode = blockers.length > 0 ? "blocked" : reservations.length > 0 ? "with_reservations" : "normal";
  return { mode, blockers, reservations, conflicts, missingData, confidenceLevel };
}