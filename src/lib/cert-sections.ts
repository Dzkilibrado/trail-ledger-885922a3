export type CertSectionKey =
  | "basic"
  | "photo"
  | "usage"
  | "conservation"
  | "health"
  | "upcoming"
  | "history"
  | "costs"
  | "photos"
  | "invoices"
  | "documents"
  | "workshop"
  | "owners";

export type CertSection = {
  key: CertSectionKey;
  label: string;
  description: string;
  /** marked sensitive — must be opted-in by user */
  sensitive?: boolean;
  /** default value when generating a fresh certificate */
  defaultOn: boolean;
};

export const CERT_SECTIONS: CertSection[] = [
  { key: "basic",        label: "Dados básicos da moto",   description: "Marca, modelo, ano, placa, chassi, Renavam.",            defaultOn: true },
  { key: "photo",        label: "Foto principal",          description: "Imagem de capa cadastrada na moto.",                      defaultOn: true },
  { key: "usage",        label: "Horas e quilometragem",   description: "Horímetro e odômetro acumulados.",                        defaultOn: true },
  { key: "conservation", label: "Índice de Conservação",   description: "Pontuação 0–100 e fatores que a compõem.",                defaultOn: true },
  { key: "health",       label: "Painel de saúde",         description: "Indicadores por categoria (motor, freios, etc).",         defaultOn: true },
  { key: "upcoming",     label: "Próximas manutenções",    description: "Itens em breve, devidos ou vencidos.",                    defaultOn: true },
  { key: "history",      label: "Histórico de manutenções", description: "Últimas manutenções e revisões.",                         defaultOn: true },
  { key: "photos",       label: "Fotos do histórico",      description: "Quantidade de fotos anexadas como evidência.",            defaultOn: true },
  { key: "workshop",     label: "Oficina responsável",     description: "Oficinas que registraram serviços, incluindo verificadas.", defaultOn: true },
  { key: "costs",        label: "Custos",                  description: "Valor total investido e custos por evento.",              sensitive: true, defaultOn: false },
  { key: "invoices",     label: "Notas fiscais",           description: "Contagem de notas fiscais anexadas.",                     sensitive: true, defaultOn: false },
  { key: "documents",    label: "Documentos",              description: "Documentos anexados (CRLV, manuais, etc).",               sensitive: true, defaultOn: false },
  { key: "owners",       label: "Histórico de proprietários", description: "Transferências de titularidade registradas.",          sensitive: true, defaultOn: false },
];

export const DEFAULT_SECTIONS: CertSectionKey[] = CERT_SECTIONS.filter((s) => s.defaultOn).map((s) => s.key);

/**
 * Audience presets — mapeamento fixo de persona → seções liberadas.
 * Fonte única para o botão "Compartilhar como…". Cada preset é aditivo
 * ao DEFAULT_SECTIONS; sensíveis só entram onde faz sentido para aquela
 * audiência. "custom" preserva a seleção manual do usuário.
 */
export type CertAudience = "buyer" | "workshop" | "insurer" | "dispatcher" | "family" | "custom";

export const AUDIENCE_LABEL: Record<CertAudience, string> = {
  buyer: "Comprador",
  workshop: "Oficina",
  insurer: "Seguradora",
  dispatcher: "Despachante",
  family: "Familiar",
  custom: "Personalizado",
};

export const AUDIENCE_DESCRIPTION: Record<CertAudience, string> = {
  buyer: "Foco em confiança: identidade, histórico, saúde, nota fiscal e proprietários anteriores.",
  workshop: "Foco técnico: identidade, saúde, plano e histórico completo de manutenções.",
  insurer: "Foco em cobertura: identidade, histórico, documentos, custos e proprietários.",
  dispatcher: "Foco documental: identidade e documentos da moto.",
  family: "Visão resumida — identidade, saúde e histórico principal.",
  custom: "Seleção manual das seções — o usuário decide.",
};

export const AUDIENCE_PRESETS: Record<Exclude<CertAudience, "custom">, CertSectionKey[]> = {
  buyer: ["basic", "photo", "usage", "conservation", "health", "upcoming", "history", "photos", "workshop", "invoices", "owners"],
  workshop: ["basic", "photo", "usage", "conservation", "health", "upcoming", "history", "photos", "workshop"],
  insurer: ["basic", "photo", "usage", "conservation", "health", "history", "photos", "workshop", "costs", "invoices", "documents", "owners"],
  dispatcher: ["basic", "photo", "documents"],
  family: ["basic", "photo", "usage", "conservation", "health", "upcoming", "history"],
};

export function isAllowed(allowed: unknown, key: CertSectionKey): boolean {
  if (!Array.isArray(allowed)) return false;
  return (allowed as string[]).includes(key);
}

export type CertStatus = "active" | "private" | "expired" | "revoked";

export function effectiveStatus(row: { status?: string | null; expires_at?: string | null }): CertStatus {
  const s = (row.status as CertStatus) || "active";
  if (s === "active" && row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return s;
}

export const STATUS_LABEL: Record<CertStatus, string> = {
  active: "Ativo",
  private: "Privado",
  expired: "Expirado",
  revoked: "Revogado",
};

import { TONE } from "@/lib/ui/status-styles";

export const STATUS_TONE: Record<CertStatus, string> = {
  active: TONE.emerald,
  private: TONE.muted,
  expired: TONE.amber,
  revoked: TONE.destructive,
};