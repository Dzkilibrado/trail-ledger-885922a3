import type { ActionGroup } from "@/lib/til/action-plan";

/** Versão do formato do Laudo Inteligente TrailBook. */
export const REPORT_FORMAT_VERSION = "laudo-1.0.0";

// ── Finalidade do laudo ────────────────────────────────────────
export type ReportPurpose = "comercial" | "oficina" | "pessoal";

export const REPORT_PURPOSE_LABEL: Record<ReportPurpose, string> = {
  comercial: "Comercial",
  oficina: "Oficina",
  pessoal: "Pessoal",
};

export const REPORT_PURPOSE_DEFAULT_TITLE: Record<ReportPurpose, string> = {
  comercial: "Laudo Comercial",
  oficina: "Laudo de Oficina",
  pessoal: "Laudo da Moto",
};

export const REPORT_PURPOSE_DESCRIPTION: Record<ReportPurpose, string> = {
  comercial: "Venda, compra ou transferência — histórico completo para o comprador",
  oficina: "Revisão ou manutenção — pendências e próximas intervenções para o mecânico",
  pessoal: "Documentação pessoal, seguro ou arquivo — visão completa da moto",
};

/** Validades disponíveis para o QR Code de documentos (em dias; 0 = sem expiração). */
export const DOCS_QR_VALIDITY_OPTIONS = [
  { label: "24 horas", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "Sem expiração", days: 0 },
] as const;

export type DocsQrValidityDays = 1 | 7 | 30 | 90 | 0;

/** Configuração definida pelo usuário antes da emissão. */
export interface ReportEmissionConfig {
  purpose: ReportPurpose;
  /** Título personalizado; se vazio usa REPORT_PURPOSE_DEFAULT_TITLE[purpose]. */
  customTitle: string;
  includeDocsQr: boolean;
  docsQrValidityDays: DocsQrValidityDays;
}
/** Versão da TIL que produziu a análise. */
export const TIL_VERSION = "til-3.0.0";

export const REPORT_DISCLAIMER =
  "Este laudo foi gerado com base nos dados registrados no TrailBook até a data de emissão. " +
  "Ele auxilia no acompanhamento da motocicleta, mas não substitui inspeção técnica ou avaliação mecânica presencial.";

export type ReportStatus = "valid" | "expiring" | "outdated" | "superseded" | "revoked";

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  valid: "Válido",
  expiring: "Próximo do vencimento",
  outdated: "Desatualizado",
  superseded: "Substituído por novo laudo",
  revoked: "Revogado",
};

export type ReportSection =
  | "identification"
  | "summary"
  | "components"
  | "action_plan"
  | "history"
  | "indices"
  | "reservations";

export const SECTION_LABEL: Record<ReportSection, string> = {
  identification: "Identificação da moto",
  summary: "Resumo geral",
  components: "Diagnóstico por componente",
  action_plan: "Plano de Ação",
  history: "Histórico resumido",
  indices: "Índices",
  reservations: "Ressalvas",
};

export interface SnapshotComponent {
  scheduleId: string;
  name: string;
  category: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  severity: string;
  conclusion: string;
  reasons: string[];
  trend: string;
  trendLabel: string;
  lifeRemainingLabel: string;
  lifeRemainingPct: number | null;
  nextAction: string;
  dueEstimateLabel: string;
  confidenceLevel: string;
  confidenceLabel: string;
  missingData: string[];
  hasConflict: boolean;
  isSafetyItem: boolean;
  remainingLabel: string;
  rulesFired: string[];
}

export interface SnapshotRecommendation {
  scheduleId: string;
  group: ActionGroup;
  groupLabel: string;
  title: string;
  recommendation: string;
  status: string;
  lifecycle: string;
  dueEstimateLabel: string;
  isSafetyItem: boolean;
}

export interface HealthReportSnapshot {
  formatVersion: string;
  tilVersion: string;
  ruleVersion: string;
  issuedAt: string;
  timezone: string;
  issuedBy: { id: string; name: string | null };
  owner: { id: string; name: string | null };
  motorcycle: {
    id: string;
    trailbookId: string;
    nickname: string | null;
    brand: string;
    model: string;
    yearMake: number | null;
    yearModel: number | null;
    displacement: number | null;
    plate: string | null;
    chassisMasked: string | null;
    controlType: string;
    condition: string;
    hoursTotal: number;
    kmTotal: number;
    mainPhotoUrl: string | null;
  };
  overall: {
    status: string;
    statusLabel: string;
    grade: string;
    gradeLabel: string;
    headline: string;
    conservationIndex: number;
  };
  rideAnswer: {
    status: string;
    title: string;
    message: string;
    rationale: string;
    counts: { critical: number; attention: number; ok: number; unknown: number; total: number };
    disclaimer: string;
  };
  components: SnapshotComponent[];
  recommendations: SnapshotRecommendation[];
  nextMaintenance: { name: string; remainingLabel: string; status: string } | null;
  history: {
    lastMaintenances: Array<{ date: string; title: string; type: string }>;
    lastInspections: Array<{ date: string; decision: string; notes: string | null }>;
    incidents: Array<{ date: string; title: string }>;
    totalEvents: number;
  };
  indices: {
    conservation: number;
    conservationExplanation: string;
    confidenceLevel: string;
    confidenceLabel: string;
    confidenceExplanation: string;
  };
  reservations: string[];
  conflicts: string[];
  missingData: string[];
  dataSources: string[];
  /** Finalidade do laudo definida pelo usuário na emissão. */
  purpose?: ReportPurpose;
  /** Título exibido no laudo (personalizado ou padrão da finalidade). */
  reportTitle?: string;
  validity: {
    validUntil: string | null;
    hoursLimit: number | null;
    kmLimit: number | null;
    reason: string;
    label: string;
  };
  disclaimer: string;
}