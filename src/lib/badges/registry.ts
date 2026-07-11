/**
 * Registry central de Selos de Qualidade do Histórico.
 *
 * ➤ Para adicionar um novo selo:
 *    1. Estender `BadgeId` em `./types.ts`.
 *    2. Adicionar uma entrada aqui com `evaluate(evidence)` puro.
 *    3. (Opcional) Expor um ponto de leitura extra em `useMotorcycleEvidence`
 *       caso o critério precise de dados ainda não coletados.
 *
 * Nenhum componente precisa mudar — a UI consome o registry.
 */

import { RECOMMENDED_DOC_TYPES, DOC_TYPE_LABEL } from "@/lib/motorcycle-documents";
import type { BadgeDefinition, EvidenceSnapshot, Criterion } from "./types";

const TIMELINE_TARGET_EVENTS = 5;
const PHOTOS_TARGET = 3;

function crit(label: string, met: boolean, hint?: string): Criterion {
  return { label, state: met ? "met" : "unmet", hint };
}

function stateFrom(criteria: Criterion[]) {
  const relevant = criteria.filter((c) => c.state !== "n/a");
  const met = relevant.filter((c) => c.state === "met").length;
  const progress = relevant.length === 0 ? 0 : met / relevant.length;
  const state = met === relevant.length ? "earned" : met === 0 ? "locked" : "partial";
  return { state, progress } as const;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "origin_proven",
    title: "Origem Comprovada",
    short: "Origem",
    tier: "bronze",
    glyph: "🟢",
    description:
      "A origem desta motocicleta foi comprovada por documento válido (Nota Fiscal ou Recibo de Compra e Venda) anexado ao histórico permanente.",
    evaluate: (e: EvidenceSnapshot) => {
      const criteria: Criterion[] = [
        crit("Documento de origem anexado", e.documents.hasOriginDocument),
      ];
      const s = stateFrom(criteria);
      return { state: s.state, progress: s.progress, criteria };
    },
  },
  {
    id: "documentation_complete",
    title: "Documentação Completa",
    short: "Docs",
    tier: "silver",
    glyph: "📚",
    description:
      "Todos os documentos recomendados da motocicleta estão anexados e ativos.",
    evaluate: (e) => {
      const criteria: Criterion[] = RECOMMENDED_DOC_TYPES.map((t) =>
        crit(`${DOC_TYPE_LABEL[t]} anexado`, (e.documents.activeByType[t] ?? 0) > 0),
      );
      const s = stateFrom(criteria);
      return { state: s.state, progress: s.progress, criteria };
    },
  },
  {
    id: "timeline_rich",
    title: "Histórico Cronológico",
    short: "Histórico",
    tier: "silver",
    glyph: "🕒",
    description:
      "A moto possui um histórico consistente de eventos registrados ao longo do tempo — quanto mais completo, maior a confiança para futuros compradores.",
    evaluate: (e) => {
      const count = e.timeline.eventCount;
      const criteria: Criterion[] = [
        crit(
          `Ao menos ${TIMELINE_TARGET_EVENTS} eventos registrados`,
          count >= TIMELINE_TARGET_EVENTS,
          `${count} registrado(s) até agora.`,
        ),
        crit(
          "Primeiro evento registrado",
          !!e.timeline.firstEventAt,
        ),
      ];
      const met = criteria.filter((c) => c.state === "met").length;
      const progress = Math.min(1, count / TIMELINE_TARGET_EVENTS);
      const state = met === criteria.length ? "earned" : met === 0 ? "locked" : "partial";
      return { state, progress, criteria };
    },
  },
  {
    id: "maintenance_on_track",
    title: "Manutenção em Dia",
    short: "Em dia",
    tier: "gold",
    glyph: "🛠️",
    description:
      "Nenhum componente do plano de manutenção está vencido — a moto está pronta para rodar com segurança.",
    evaluate: (e) => {
      const criteria: Criterion[] = [
        crit(
          "Sem componentes vencidos",
          e.maintenance.overdueCount === 0,
          e.maintenance.overdueCount > 0
            ? `${e.maintenance.overdueCount} vencido(s)`
            : undefined,
        ),
        crit(
          "Sem alertas de alta severidade",
          e.maintenance.attentionCount === 0,
          e.maintenance.attentionCount > 0
            ? `${e.maintenance.attentionCount} em atenção`
            : undefined,
        ),
        {
          label: "Plano de manutenção configurado",
          state: e.maintenance.hasComponents ? "met" : "n/a",
          hint: e.maintenance.hasComponents ? undefined : "Sem plano ativo ainda.",
        },
      ];
      const s = stateFrom(criteria);
      return { state: s.state, progress: s.progress, criteria };
    },
  },
  {
    id: "ownership_chain_intact",
    title: "Cadeia de Propriedade Íntegra",
    short: "Cadeia",
    tier: "silver",
    glyph: "🔗",
    description:
      "O histórico de propriedade está registrado sem lacunas — cada transferência tem início e fim documentados.",
    evaluate: (e) => {
      const criteria: Criterion[] = [
        crit("Histórico de propriedade registrado", e.ownership.entries > 0),
        crit("Proprietário atual em aberto", e.ownership.hasOpenCurrentOwner),
        crit(
          "Sem lacunas na cadeia",
          e.ownership.gaps === 0,
          e.ownership.gaps > 0 ? `${e.ownership.gaps} lacuna(s)` : undefined,
        ),
      ];
      const s = stateFrom(criteria);
      return { state: s.state, progress: s.progress, criteria };
    },
  },
  {
    id: "official_photos",
    title: "Fotos Oficiais",
    short: "Fotos",
    tier: "bronze",
    glyph: "📸",
    description:
      "A moto possui fotos suficientes para compor seu Passaporte Digital, incluindo uma foto de capa.",
    evaluate: (e) => {
      const criteria: Criterion[] = [
        crit("Foto de capa definida", e.photos.hasCover),
        crit(
          `Ao menos ${PHOTOS_TARGET} fotos anexadas`,
          e.photos.total >= PHOTOS_TARGET,
          `${e.photos.total} atual(is).`,
        ),
      ];
      const s = stateFrom(criteria);
      return {
        state: s.state,
        progress: Math.min(1, e.photos.total / PHOTOS_TARGET),
        criteria,
      };
    },
  },
  {
    id: "history_complete",
    title: "Histórico Completo",
    short: "Completo",
    tier: "signature",
    glyph: "🟢",
    description:
      "A motocicleta possui um histórico consistente, completo e bem documentado — origem comprovada, documentação completa e cadeia de propriedade íntegra, conforme as regras automáticas do sistema. Este selo é derivado de evidências reais e não representa validação presencial ou auditoria oficial do TrailBook.",
    evaluate: (e) => {
      // Este selo depende de outros — reavalia inline para manter o motor puro.
      const origin = BADGES.find((b) => b.id === "origin_proven")!.evaluate(e);
      const docs = BADGES.find((b) => b.id === "documentation_complete")!.evaluate(e);
      const chain = BADGES.find((b) => b.id === "ownership_chain_intact")!.evaluate(e);
      const criteria: Criterion[] = [
        crit("Origem Comprovada", origin.state === "earned"),
        crit("Documentação Completa", docs.state === "earned"),
        crit("Cadeia de Propriedade Íntegra", chain.state === "earned"),
      ];
      const s = stateFrom(criteria);
      return { state: s.state, progress: s.progress, criteria };
    },
  },
];

export const BADGE_BY_ID: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGES.map((b) => [b.id, b]),
);

/** Peso por tier — alimenta o score agregado em `evaluator.ts`. */
export const TIER_WEIGHT: Record<BadgeDefinition["tier"], number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  signature: 5,
};