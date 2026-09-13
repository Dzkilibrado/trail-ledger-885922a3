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
  { key: "conservation", label: "Estado de Conservação",   description: "Estado geral de conservação e os principais fatores que o compõem.",                defaultOn: true },
  { key: "health",       label: "Painel de saúde",         description: "Indicadores por categoria (motor, freios, etc).",         defaultOn: true },
  { key: "upcoming",     label: "Próximas manutenções",    description: "Itens em breve, devidos ou vencidos.",                    defaultOn: true },
  { key: "history",      label: "Histórico de eventos",    description: "Últimas manutenções, revisões e outros eventos registrados.",                  defaultOn: true },
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
export type CertAudience = "buyer" | "workshop" | "insurer" | "dispatcher" | "family" | "custom" | "inspection";

export const AUDIENCE_LABEL: Record<CertAudience, string> = {
  buyer: "Comprador",
  workshop: "Oficina",
  insurer: "Seguradora",
  dispatcher: "Despachante",
  family: "Familiar",
  custom: "Personalizado",
  inspection: "Fiscalização",
};

export const AUDIENCE_DESCRIPTION: Record<CertAudience, string> = {
  buyer:      "Prioriza origem e documentação, proprietários anteriores, estado atual e histórico de manutenção — tudo que ajuda a avaliar a procedência da moto.",
  workshop:   "Foco técnico: situação atual, próximos serviços, saúde por categoria e histórico de manutenção. Sem informações de propriedade ou financeiras.",
  insurer:    "Dados completos para análise de risco: conservação, histórico, documentos, custos, propriedade e evidências.",
  dispatcher: "Apenas identificação, foto e documentação — Nota Fiscal, outros documentos e histórico de proprietários.",
  family:     "Visão simplificada: identificação, estado geral, saúde e manutenções importantes. Sem custos ou documentos sensíveis.",
  custom:     "Seções selecionadas manualmente. Ajuste os controles abaixo conforme necessário.",
  inspection: "Modo Fiscalização: identificação da moto, proprietário atual e documento de origem para apresentação presencial.",
};

export const AUDIENCE_PRESETS: Record<Exclude<CertAudience, "custom">, CertSectionKey[]> = {
  buyer:      ["basic", "photo", "usage", "conservation", "health", "upcoming", "history", "photos", "workshop", "invoices", "owners"],
  workshop:   ["basic", "usage", "conservation", "upcoming", "health", "history", "photos", "workshop"],
  insurer:    ["basic", "photo", "usage", "conservation", "history", "owners", "invoices", "documents", "costs", "workshop", "photos"],
  dispatcher: ["basic", "photo", "invoices", "documents", "owners"],
  family:     ["basic", "photo", "usage", "conservation", "health", "upcoming", "history"],
  /** Modo Fiscalização: apenas identificação básica + foto + uso + documentação de origem.
   *  NÃO inclui "owners" — o nome do proprietário vem de data.owner diretamente no payload. */
  inspection: ["basic", "photo", "usage", "invoices"],
};

/**
 * Ordem de exibição das seções por audiência.
 * Diferente de AUDIENCE_PRESETS (que define o QUE é exibido),
 * AUDIENCE_SECTION_ORDER define a SEQUÊNCIA de renderização.
 * Seções não listadas aqui aparecem no final na ordem padrão.
 */
export const AUDIENCE_SECTION_ORDER: Record<Exclude<CertAudience, "custom">, CertSectionKey[]> = {
  buyer:      ["basic", "photo", "usage", "invoices", "owners", "conservation", "history", "upcoming", "health", "photos", "workshop"],
  workshop:   ["basic", "usage", "conservation", "upcoming", "health", "history", "photos", "workshop"],
  insurer:    ["basic", "photo", "usage", "conservation", "history", "owners", "invoices", "documents", "costs", "workshop", "photos"],
  dispatcher: ["basic", "photo", "invoices", "documents", "owners"],
  family:     ["basic", "photo", "usage", "conservation", "health", "upcoming", "history"],
  /** Modo Fiscalização: foto + básico + uso + documentação de origem */
  inspection: ["basic", "photo", "usage", "invoices"],
};

/** Título/banner por audiência — exibido na página pública e PDF. */
export const AUDIENCE_BANNER: Record<CertAudience, string> = {
  buyer:      "Certificado para Comprador",
  workshop:   "Resumo para Oficina",
  insurer:    "Documentação para Seguradora",
  dispatcher: "Documentação para Despachante",
  family:     "Resumo para Familiar",
  custom:     "Certificado Digital",
  inspection: "Apresentação da Motocicleta",
};

/**
 * O que cada audiência mostra e não mostra — para o preview da configuração.
 */
/** Inspection não aparece no CertificateSettingsDialog — é criado pelo Modo Fiscalização */
export const AUDIENCE_SHOWS: Record<Exclude<CertAudience, "custom" | "inspection">, { shows: string[]; hides: string[] }> = {
  buyer: {
    shows: ["Identificação da moto", "Horas/km", "Nota fiscal", "Proprietários anteriores", "Estado de conservação", "Histórico de manutenção", "Fotos", "Oficinas"],
    hides: ["Custos", "Documentos CRLV/outros"],
  },
  workshop: {
    shows: ["Identificação da moto", "Horas/km atuais", "Situação atual", "Próximas manutenções", "Painel de saúde", "Histórico de serviços", "Fotos de evidência"],
    hides: ["Custos", "Nota fiscal", "Proprietários", "Documentos pessoais"],
  },
  insurer: {
    shows: ["Identificação", "Horas/km", "Conservação", "Histórico", "Proprietários", "Nota fiscal", "Documentos", "Custos", "Oficinas", "Fotos"],
    hides: ["Próximas manutenções (foco em histórico)"],
  },
  dispatcher: {
    shows: ["Identificação da moto", "Foto", "Nota fiscal", "Documentos", "Proprietários"],
    hides: ["Horas/km", "Conservação", "Manutenção", "Histórico", "Custos"],
  },
  family: {
    shows: ["Identificação da moto", "Foto", "Horas/km", "Estado geral", "Saúde", "Próximas manutenções", "Histórico principal"],
    hides: ["Custos", "Nota fiscal", "Proprietários", "Fotos de evidência", "Oficinas"],
  },
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