import type { HealthReportSnapshot, SnapshotComponent } from "./types";

export type ChangeKind =
  | "improved"
  | "worsened"
  | "unchanged"
  | "new_data"
  | "became_unknown"
  | "became_evaluable"
  | "added"
  | "removed";

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  improved: "Melhorou",
  worsened: "Piorou",
  unchanged: "Sem alteração relevante",
  new_data: "Novo dado",
  became_unknown: "Deixou de ser avaliável",
  became_evaluable: "Passou a ser avaliável",
  added: "Novo componente",
  removed: "Não avaliado neste laudo",
};

const WEIGHT: Record<string, number> = { action: 0, attention: 1, unknown: 2, ok: 3 };

export interface ComponentComparison {
  name: string;
  categoryLabel: string;
  from: string | null;
  to: string | null;
  fromLabel: string;
  toLabel: string;
  change: ChangeKind;
}

export interface ReportComparison {
  periodDays: number;
  from: { code: string; issuedAt: string; status: string; statusLabel: string; conservation: number };
  to: { code: string; issuedAt: string; status: string; statusLabel: string; conservation: number };
  overallChange: ChangeKind;
  overallSummary: string;
  resolved: ComponentComparison[];
  worsened: ComponentComparison[];
  improved: ComponentComparison[];
  newAlerts: ComponentComparison[];
  components: ComponentComparison[];
  recommendations: { resolved: string[]; stillPending: string[]; newOnes: string[] };
  indices: {
    conservationDelta: number;
    conservationNarrative: string;
    confidenceFrom: string;
    confidenceTo: string;
  };
}

function classify(a: SnapshotComponent | undefined, b: SnapshotComponent | undefined): ChangeKind {
  if (!a && b) return "added";
  if (a && !b) return "removed";
  if (!a || !b) return "unchanged";
  if (a.status === "unknown" && b.status !== "unknown") return "became_evaluable";
  if (a.status !== "unknown" && b.status === "unknown") return "became_unknown";
  const wa = WEIGHT[a.status] ?? 9;
  const wb = WEIGHT[b.status] ?? 9;
  if (wb > wa) return "improved";
  if (wb < wa) return "worsened";
  if (a.confidenceLevel !== b.confidenceLevel) return "new_data";
  return "unchanged";
}

export function compareReports(
  older: { code: string; snapshot: HealthReportSnapshot },
  newer: { code: string; snapshot: HealthReportSnapshot },
): ReportComparison {
  const a = older.snapshot;
  const b = newer.snapshot;
  const byName = (list: SnapshotComponent[]) => new Map(list.map((c) => [c.name, c] as const));
  const ma = byName(a.components);
  const mb = byName(b.components);
  const names = Array.from(new Set([...ma.keys(), ...mb.keys()])).sort((x, y) => x.localeCompare(y));

  const components: ComponentComparison[] = names.map((name) => {
    const ca = ma.get(name);
    const cb = mb.get(name);
    return {
      name,
      categoryLabel: (cb ?? ca)?.categoryLabel ?? "",
      from: ca?.status ?? null,
      to: cb?.status ?? null,
      fromLabel: ca?.statusLabel ?? "—",
      toLabel: cb?.statusLabel ?? "—",
      change: classify(ca, cb),
    };
  });

  const improved = components.filter((c) => c.change === "improved");
  const worsened = components.filter((c) => c.change === "worsened");
  const resolved = improved.filter((c) => c.from === "action" && c.to === "ok");
  const newAlerts = components.filter((c) => c.to === "action" && c.from !== "action");

  const recA = new Map(a.recommendations.map((r) => [r.title, r] as const));
  const recB = new Map(b.recommendations.map((r) => [r.title, r] as const));
  const recommendations = {
    resolved: Array.from(recA.keys()).filter((k) => !recB.has(k)),
    stillPending: Array.from(recB.keys()).filter((k) => recA.has(k)),
    newOnes: Array.from(recB.keys()).filter((k) => !recA.has(k)),
  };

  const delta = b.indices.conservation - a.indices.conservation;
  let narrative: string;
  if (delta > 0) {
    const drivers = improved.slice(0, 2).map((c) => c.name.toLowerCase());
    narrative = drivers.length
      ? `O Índice de Conservação melhorou após avanços em ${drivers.join(" e ")}.`
      : "O Índice de Conservação melhorou com o aumento de registros e evidências.";
  } else if (delta < 0) {
    const drivers = worsened.slice(0, 2).map((c) => c.name.toLowerCase());
    narrative = drivers.length
      ? `O Índice de Conservação caiu principalmente por causa de ${drivers.join(" e ")}.`
      : "O Índice de Conservação caiu pela falta de registros recentes.";
  } else {
    narrative = "O Índice de Conservação permaneceu estável entre os dois laudos.";
  }

  const wA = WEIGHT[a.overall.status] ?? 9;
  const wB = WEIGHT[b.overall.status] ?? 9;
  const overallChange: ChangeKind = wB > wA ? "improved" : wB < wA ? "worsened" : "unchanged";
  const overallSummary =
    overallChange === "improved"
      ? "O estado geral da moto melhorou entre os dois laudos."
      : overallChange === "worsened"
        ? "O estado geral da moto piorou entre os dois laudos."
        : "O estado geral da moto se manteve entre os dois laudos.";

  const periodDays = Math.max(
    0,
    Math.round((new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()) / 86400000),
  );

  return {
    periodDays,
    from: { code: older.code, issuedAt: a.issuedAt, status: a.overall.status, statusLabel: a.overall.statusLabel, conservation: a.indices.conservation },
    to: { code: newer.code, issuedAt: b.issuedAt, status: b.overall.status, statusLabel: b.overall.statusLabel, conservation: b.indices.conservation },
    overallChange,
    overallSummary,
    resolved,
    worsened,
    improved,
    newAlerts,
    components,
    recommendations,
    indices: {
      conservationDelta: delta,
      conservationNarrative: narrative,
      confidenceFrom: a.indices.confidenceLabel,
      confidenceTo: b.indices.confidenceLabel,
    },
  };
}