import type { Database } from "@/integrations/supabase/types";
import type { ScheduleStatus } from "./maintenance-engine";
import { SEVERITY_WEIGHT } from "./maintenance-presets";
import type { MaintenanceCategory } from "./trailbook";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type Attachment = Database["public"]["Tables"]["event_attachments"]["Row"];

export interface ScoreFactor {
  key: string;
  label: string;
  delta: number;          // contribuição (+/-) ao score
  detail?: string;
}

export interface ConservationResult {
  score: number;          // 0..100
  grade: "A" | "B" | "C" | "D" | "E";
  factors: ScoreFactor[];
}

const BASE = 80;

/**
 * Calcula índice de conservação 0..100 com fatores transparentes.
 * Toda regra fica nesse arquivo — facilmente ajustável.
 */
export function computeConservation(input: {
  events: EventRow[];
  attachments: Attachment[];
  statuses: ScheduleStatus[];
  workshopEventIds: Set<string>;
  hasDocs: { plate: boolean; renavam: boolean; chassis: boolean };
}): ConservationResult {
  const { events, attachments, statuses, workshopEventIds, hasDocs } = input;
  const factors: ScoreFactor[] = [];

  factors.push({ key: "base", label: "Pontuação base", delta: BASE });

  // 1. Cumprimento de intervalos: penaliza vencidos por severidade
  let overdue = 0;
  for (const s of statuses) {
    if (s.status === "overdue") {
      const w = SEVERITY_WEIGHT[s.severity];
      overdue += w * 2;
    } else if (s.status === "due") {
      overdue += 1;
    }
  }
  if (overdue > 0) factors.push({ key: "overdue", label: "Manutenções vencidas", delta: -Math.min(40, overdue), detail: `${statuses.filter((s) => s.status === "overdue").length} vencida(s)` });
  else if (statuses.length > 0) factors.push({ key: "on_time", label: "Manutenções em dia", delta: 5 });

  // 2. Evidências: anexos por evento de manutenção
  const maintEvents = events.filter((e) => e.type === "maintenance" || e.type === "revision");
  const withEvidence = maintEvents.filter((e) => attachments.some((a) => a.event_id === e.id));
  if (maintEvents.length > 0) {
    const ratio = withEvidence.length / maintEvents.length;
    const delta = Math.round(ratio * 8);
    factors.push({ key: "evidence", label: "Evidências em manutenções (fotos/NF)", delta, detail: `${withEvidence.length}/${maintEvents.length} com anexo` });
  } else {
    factors.push({ key: "no_history", label: "Sem histórico de manutenções", delta: -10 });
  }

  // 3. Histórico contínuo: gap > 180 dias penaliza
  const sorted = [...events].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  if (sorted.length > 0) {
    const daysSinceLast = (Date.now() - new Date(sorted[0].occurred_at).getTime()) / 86400000;
    if (daysSinceLast > 180) factors.push({ key: "stale", label: "Sem atualizações recentes", delta: -8, detail: `${Math.round(daysSinceLast)} dias` });
    else if (daysSinceLast < 30) factors.push({ key: "fresh", label: "Histórico atualizado", delta: 3 });
  }

  // 4. Oficina parceira: bônus por registros vindos de oficina
  const fromWorkshop = events.filter((e) => workshopEventIds.has(e.id)).length;
  if (fromWorkshop > 0) factors.push({ key: "workshop", label: "Registros por oficina", delta: Math.min(6, fromWorkshop), detail: `${fromWorkshop} evento(s)` });

  // 5. Documentação
  const docCount = (hasDocs.plate ? 1 : 0) + (hasDocs.renavam ? 1 : 0) + (hasDocs.chassis ? 1 : 0);
  if (docCount === 3) factors.push({ key: "docs_full", label: "Documentação completa", delta: 4 });
  else if (docCount === 0) factors.push({ key: "docs_missing", label: "Documentação ausente", delta: -6 });
  else factors.push({ key: "docs_partial", label: "Documentação parcial", delta: -2, detail: `${docCount}/3` });

  const raw = factors.reduce((s, f) => s + f.delta, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";

  return { score, grade, factors };
}

export interface CategoryHealth {
  category: MaintenanceCategory | "documentation" | "history";
  label: string;
  score: number;        // 0..100
  status: "good" | "warn" | "bad";
  reason: string;
}

const CAT_LABEL: Record<MaintenanceCategory, string> = {
  engine: "Motor",
  suspension: "Suspensão",
  brakes: "Freios",
  transmission: "Transmissão",
  wheels: "Rodas",
  electrical: "Elétrica",
  cooling: "Arrefecimento",
  other: "Outros",
};

export function categoryHealth(statuses: ScheduleStatus[]): CategoryHealth[] {
  const cats: MaintenanceCategory[] = ["engine", "suspension", "brakes", "transmission", "wheels", "electrical"];
  return cats.map((c) => {
    const list = statuses.filter((s) => s.category === c);
    if (list.length === 0) return { category: c, label: CAT_LABEL[c], score: 70, status: "warn" as const, reason: "Sem programação cadastrada" };
    const overdue = list.filter((s) => s.status === "overdue").length;
    const due     = list.filter((s) => s.status === "due").length;
    const avgProgress = list.reduce((sum, s) => sum + Math.min(1, s.progress), 0) / list.length;
    const score = Math.max(0, Math.round(100 - avgProgress * 70 - overdue * 15));
    const status: CategoryHealth["status"] = overdue > 0 ? "bad" : due > 0 ? "warn" : "good";
    const reason = overdue > 0 ? `${overdue} vencida(s)` : due > 0 ? `${due} próxima(s) do vencimento` : "Em dia";
    return { category: c, label: CAT_LABEL[c], score, status, reason };
  });
}

export function docsHealth(hasDocs: { plate: boolean; renavam: boolean; chassis: boolean }): CategoryHealth {
  const n = (hasDocs.plate ? 1 : 0) + (hasDocs.renavam ? 1 : 0) + (hasDocs.chassis ? 1 : 0);
  const score = Math.round((n / 3) * 100);
  return {
    category: "documentation",
    label: "Documentação",
    score,
    status: n === 3 ? "good" : n === 0 ? "bad" : "warn",
    reason: n === 3 ? "Placa, chassi e RENAVAM" : `${n}/3 documentos preenchidos`,
  };
}

export function historyHealth(events: EventRow[]): CategoryHealth {
  if (events.length === 0) return { category: "history", label: "Histórico", score: 30, status: "bad", reason: "Sem eventos registrados" };
  const sorted = [...events].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  const days = (Date.now() - new Date(sorted[0].occurred_at).getTime()) / 86400000;
  const score = days < 30 ? 100 : days < 90 ? 80 : days < 180 ? 60 : 40;
  const status: CategoryHealth["status"] = days < 90 ? "good" : days < 180 ? "warn" : "bad";
  return { category: "history", label: "Histórico", score, status, reason: `Última atualização há ${Math.round(days)} dia(s)` };
}