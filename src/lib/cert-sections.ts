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

export const STATUS_TONE: Record<CertStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  private: "bg-muted text-muted-foreground border-border",
  expired: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  revoked: "bg-destructive/15 text-destructive border-destructive/30",
};