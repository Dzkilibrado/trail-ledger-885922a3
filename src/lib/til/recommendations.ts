/**
 * TrailBook Health — ciclo de vida das recomendações.
 *
 * Nesta etapa o ciclo de vida é DERIVADO (a TIL recalcula a cada leitura).
 * A estrutura já está preparada para persistência futura: uma recomendação
 * resolvida não desaparece, ela muda de estado e permanece no histórico.
 */

export type RecommendationStatus =
  | "open"
  | "scheduled"
  | "in_progress"
  | "resolved"
  | "dismissed"
  | "expired";

export const RECOMMENDATION_STATUS_LABEL: Record<RecommendationStatus, string> = {
  open: "Aberta",
  scheduled: "Programada",
  in_progress: "Em andamento",
  resolved: "Resolvida",
  dismissed: "Dispensada",
  expired: "Vencida",
};

/** Ações que o usuário pode executar a partir de uma recomendação. */
export type RecommendationAction =
  | "register_maintenance"
  | "schedule_service"
  | "add_inspection"
  | "attach_photo"
  | "confirm_service"
  | "mark_resolved"
  | "mark_not_applicable"
  | "open_history"
  | "complete_data";

export const RECOMMENDATION_ACTION_LABEL: Record<RecommendationAction, string> = {
  register_maintenance: "Registrar manutenção",
  schedule_service: "Agendar revisão",
  add_inspection: "Adicionar inspeção",
  attach_photo: "Anexar foto",
  confirm_service: "Confirmar serviço",
  mark_resolved: "Marcar como resolvida",
  mark_not_applicable: "Informar que não se aplica",
  open_history: "Abrir histórico do componente",
  complete_data: "Completar informações",
};

/** Registro histórico de uma recomendação (preparado para persistência). */
export interface RecommendationRecord {
  id: string;
  motorcycleId: string;
  scheduleId: string;
  componentName: string;
  status: RecommendationStatus;
  priority: string;
  issuedAt: string;
  /** De onde veio: regra do diagnóstico que a originou. */
  origin: string;
  ruleVersion: string;
  dueEstimateLabel: string;
  ownerId: string | null;
  relatedEventId: string | null;
  resolvedAt: string | null;
  evidence: string | null;
  dismissReason: string | null;
}
