/**
 * TrailBook Passport — Passaporte Digital da Motocicleta.
 *
 * Documento vivo, agregador SSOT. Não persiste dados próprios: consome
 * módulos existentes (motorcycles, events, motorcycle_documents,
 * motorcycle_photos, ownership_history, certificates, maintenance_schedules,
 * workshops) e retorna a visão consolidada do passaporte.
 *
 * Extensão futura documentada abaixo — arquitetura preparada, sem
 * implementação prematura. Cada bloco marcado com `EXT:` é ponto de
 * evolução planejado. Não criar tabelas paralelas para score/certificação
 * enquanto o cálculo puder ser derivado das fontes atuais.
 */

import type { Database } from "@/integrations/supabase/types";
import type { CategoryHealth, ConservationResult } from "./conservation";

export type Motorcycle = Database["public"]["Tables"]["motorcycles"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["motorcycle_documents"]["Row"];
export type PhotoRow = Database["public"]["Tables"]["motorcycle_photos"]["Row"];
export type OwnershipRow = Database["public"]["Tables"]["ownership_history"]["Row"];
export type CertificateRow = Database["public"]["Tables"]["certificates"]["Row"];

/**
 * Tipos exibidos na Timeline do Passaporte. Superset dos tipos de evento
 * do TrailBook — inclui itens derivados (cadastro, documento, transferência,
 * certificado emitido) que não vivem na tabela `events`.
 */
export type PassportEntryKind =
  | "creation"
  | "purchase"
  | "sale"
  | "ownership_transfer"
  | "maintenance"
  | "revision"
  | "usage"
  | "incident"
  | "recall"
  | "warranty"
  | "accessory"
  | "note"
  | "document"
  | "photo"
  | "certificate";

export interface PassportEntry {
  id: string;
  kind: PassportEntryKind;
  occurredAt: string;                 // ISO
  title: string;
  description?: string | null;
  cost?: number | null;
  odometerKm?: number | null;
  workshopName?: string | null;
  source: "events" | "motorcycles" | "motorcycle_documents" | "ownership_history" | "certificates";
  sourceId: string;
}

export interface PassportPending {
  key: string;
  label: string;
  severity: "info" | "warn" | "critical";
  hint?: string;
}

// -----------------------------------------------------------------------------
// TIMELINE — agregação SSOT
// -----------------------------------------------------------------------------

export function buildTimeline(input: {
  motorcycle: Motorcycle;
  events: EventRow[];
  documents: DocumentRow[];
  ownership: OwnershipRow[];
  certificates: CertificateRow[];
  workshopsById?: Record<string, { name: string }>;
}): PassportEntry[] {
  const { motorcycle, events, documents, ownership, certificates, workshopsById } = input;
  const out: PassportEntry[] = [];

  // 1) Cadastro da moto no TrailBook
  out.push({
    id: `moto-${motorcycle.id}`,
    kind: "creation",
    occurredAt: motorcycle.created_at,
    title: "Cadastro no TrailBook",
    description: motorcycle.trailbook_id ? `ID ${motorcycle.trailbook_id}` : null,
    source: "motorcycles",
    sourceId: motorcycle.id,
  });

  // 2) Eventos (manutenção, uso, sinistro, etc.)
  for (const e of events) {
    out.push({
      id: `evt-${e.id}`,
      kind: (e.type as PassportEntryKind) ?? "note",
      occurredAt: e.occurred_at,
      title: e.title ?? "Evento",
      description: e.description,
      cost: e.cost != null ? Number(e.cost) : null,
      odometerKm: e.km_at_event,
      workshopName: e.workshop_id ? workshopsById?.[e.workshop_id]?.name : null,
      source: "events",
      sourceId: e.id,
    });
  }

  // 3) Documentos permanentes (uploads, versões atuais)
  for (const d of documents) {
    if (d.deleted_at) continue;
    out.push({
      id: `doc-${d.id}`,
      kind: "document",
      occurredAt: d.created_at,
      title: d.file_name || d.doc_type || "Documento",
      description: d.doc_type,
      source: "motorcycle_documents",
      sourceId: d.id,
    });
  }

  // 4) Trocas de proprietário / bootstrap
  for (const o of ownership) {
    if (o.method === "creation") continue; // já coberto acima
    out.push({
      id: `own-${o.id}`,
      kind: "ownership_transfer",
      occurredAt: o.started_at,
      title: o.method === "transfer" ? "Troca de proprietário" : `Propriedade (${o.method})`,
      description: o.notes,
      source: "ownership_history",
      sourceId: o.id,
    });
  }

  // 5) Certificados emitidos
  for (const c of certificates) {
    out.push({
      id: `cert-${c.id}`,
      kind: "certificate",
      occurredAt: c.created_at,
      title: "Certificado digital emitido",
      description: c.status === "revoked" ? "Revogado" : c.expires_at ? `Válido até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}` : "Sem expiração",
      source: "certificates",
      sourceId: c.id,
    });
  }

  // Ordem decrescente por data
  out.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return out;
}

// -----------------------------------------------------------------------------
// PENDÊNCIAS — derivadas dos módulos existentes
// -----------------------------------------------------------------------------

export function derivePending(input: {
  motorcycle: Motorcycle;
  documents: DocumentRow[];
  photos: PhotoRow[];
  overdueSchedules: number;
  hasInvoice: boolean;
}): PassportPending[] {
  const out: PassportPending[] = [];
  const { motorcycle, documents, photos, overdueSchedules, hasInvoice } = input;

  if (!motorcycle.plate) out.push({ key: "plate", label: "Placa não informada", severity: "warn" });
  if (!motorcycle.chassis) out.push({ key: "chassis", label: "Chassi não informado", severity: "warn" });
  if (!motorcycle.renavam) out.push({ key: "renavam", label: "RENAVAM não informado", severity: "info" });
  if (photos.filter((p) => !p.deleted_at).length === 0) out.push({ key: "photos", label: "Sem fotos cadastradas", severity: "info" });
  if (!hasInvoice) out.push({ key: "invoice", label: "Nota fiscal ausente", severity: "warn", hint: "Anexe em Documentação → Nota fiscal." });
  const activeDocs = documents.filter((d) => !d.deleted_at).length;
  if (activeDocs === 0) out.push({ key: "docs", label: "Nenhum documento anexado", severity: "warn" });
  if (overdueSchedules > 0) out.push({ key: "overdue", label: `${overdueSchedules} manutenção(ões) vencida(s)`, severity: "critical", hint: "Registre a atividade ou reprograme o plano." });

  return out;
}

// -----------------------------------------------------------------------------
// CERTIFIED TIER — derivado do score de conservação (fase 1)
// -----------------------------------------------------------------------------

/**
 * EXT: TrailBook Certified — cálculo automático, jamais manual.
 * Fase 1 (agora): derivado exclusivamente do índice de conservação já
 * existente + presença de nota fiscal + ausência de manutenções críticas.
 * Fase 2 (planejada): incorporar TrailBookScore (ver abaixo) e histórico
 * de sinistros/recalls; tornar a tier persistente em `certificates.tier`.
 */
export type CertifiedTier = "none" | "bronze" | "silver" | "gold" | "platinum" | "diamond";

export const CERTIFIED_TIER_LABEL: Record<CertifiedTier, string> = {
  none: "Sem selo",
  bronze: "TrailBook Certified Bronze",
  silver: "TrailBook Certified Silver",
  gold: "TrailBook Certified Gold",
  platinum: "TrailBook Certified Platinum",
  diamond: "TrailBook Certified Diamond",
};

export function computeCertifiedTier(input: {
  conservation: ConservationResult;
  categories: CategoryHealth[];
  hasInvoice: boolean;
  criticalPending: number;
}): { tier: CertifiedTier; reasons: string[] } {
  const { conservation, categories, hasInvoice, criticalPending } = input;
  const reasons: string[] = [];

  if (criticalPending > 0) {
    reasons.push("Existem pendências críticas — resolva-as para elevar o selo.");
    return { tier: "bronze", reasons };
  }
  if (!hasInvoice) reasons.push("Nota fiscal ainda não anexada.");

  const anyBad = categories.some((c) => c.status === "bad");
  const score = conservation.score;

  let tier: CertifiedTier = "none";
  if (score >= 95 && hasInvoice && !anyBad) tier = "diamond";
  else if (score >= 88 && hasInvoice && !anyBad) tier = "platinum";
  else if (score >= 80 && !anyBad) tier = "gold";
  else if (score >= 70) tier = "silver";
  else if (score >= 55) tier = "bronze";

  return { tier, reasons };
}

// -----------------------------------------------------------------------------
// EXT: TrailBook Score — algoritmo próprio (0..100), NÃO implementado.
// -----------------------------------------------------------------------------
/**
 * Arquitetura sugerida quando for implementar:
 *
 *   interface TrailBookScoreInput {
 *     conservation: ConservationResult;         // base
 *     planCompliance: number;                   // % de itens do plano em dia
 *     incidents: number;                        // sinistros registrados
 *     recalls: { total: number; resolved: number };
 *     documentationCompleteness: number;        // 0..1
 *     ageYears: number;
 *     mileageKm: number;
 *     consistency: number;                      // dias/mês com registros
 *   }
 *
 * Regras devem viver em `src/lib/trailbook-score.ts` (a criar), sem tabela
 * dedicada — o score é derivado. Persistir apenas snapshots (ex.: coluna
 * em `certificates`) quando congelado em um documento emitido.
 */

// -----------------------------------------------------------------------------
// EXT: Compartilhamento com níveis de visualização
// -----------------------------------------------------------------------------
/**
 * Hoje o compartilhamento externo usa `certificates` (public_token +
 * allowed_sections). O passaporte reaproveita essa infra em vez de criar
 * "shares" paralelos.
 *
 * Roadmap:
 *  - Persona presets (comprador, oficina, seguradora, despachante, familiar)
 *    → mapa fixo para `allowed_sections`; UI de "compartilhar como…".
 *  - Coluna `certificates.audience` (enum) para telemetria.
 *  - Tabela `certificate_access_log` (id, certificate_id, accessed_at, ip,
 *    user_agent, country) alimentada por edge fn / server route pública.
 *  - Revogação: já suportada por `certificates.status = 'revoked'`.
 *
 * Enquanto ambos não existem, o botão "Compartilhar" do passaporte deve
 * redirecionar para o dialog de certificado atual.
 */
export const SHARE_AUDIENCE_PRESETS = {
  public:      ["identification", "score", "photos_primary"] as string[],
  buyer:       ["identification", "score", "photos", "history_summary", "documents_invoice", "pending"] as string[],
  workshop:    ["identification", "score", "history_full", "maintenance_plan"] as string[],
  insurer:     ["identification", "score", "history_full", "documents_all", "incidents"] as string[],
  dispatcher:  ["identification", "documents_all"] as string[],
  family:      ["identification", "score", "history_summary"] as string[],
} as const;
export type ShareAudience = keyof typeof SHARE_AUDIENCE_PRESETS;

// -----------------------------------------------------------------------------
// EXT: Módulo de valorização e IA — placeholders arquiteturais
// -----------------------------------------------------------------------------
/**
 * `src/lib/valuation.ts` (a criar): recebe motorcycle + timeline + score e
 * devolve `{ estimatedValue, delta, factors[] }`. Sem tabelas próprias;
 * cache opcional em `motorcycles.metadata` (jsonb) por até 30 dias.
 *
 * `src/lib/passport-ai.ts` (a criar): consome mesma entrada e devolve
 * resumo/recomendações/riscos via Lovable AI Gateway. Toda saída deve
 * ser identificada como gerada por IA (LGPD/transparência).
 */
