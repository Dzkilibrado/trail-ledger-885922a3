import type { Database } from "@/integrations/supabase/types";
import type { ComponentView } from "./components";
import type { ActionPlanItem } from "./action-plan";
import type { HealthStatus } from "./status";
import type { RideAnswer } from "./ride-answer";

export type Moto = Database["public"]["Tables"]["motorcycles"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type Schedule = Database["public"]["Tables"]["maintenance_schedules"]["Row"];
export type Attachment = Database["public"]["Tables"]["event_attachments"]["Row"];

export type Tone = "good" | "warn" | "bad";

export type HealthGrade = "excellent" | "good" | "attention" | "critical";

export const HEALTH_GRADE_LABEL: Record<HealthGrade, string> = {
  excellent: "Excelente",
  good: "Boa",
  attention: "Atenção",
  critical: "Crítica",
};

export interface HealthBuckets {
  ok: ComponentView[];
  attention: ComponentView[];
  overdue: ComponentView[];
  noInfo: ComponentView[];
}

export interface HealthSnapshot {
  score: number; // 0..100
  label: string; // frase única, ex.: "Sua moto está saudável"
  tone: Tone;
  grade: HealthGrade;         // Excelente / Boa / Atenção / Crítica
  gradeLabel: string;
  headline: string;           // frase curta acionável ("Pronta para uso" / "Existe algo a resolver")
  buckets: HealthBuckets;     // agrupamento inteligente
  topAttention: ComponentView | null; // componente mais urgente (para o Cockpit)
  /** Linguagem oficial de status (TrailBook Health) — substitui a nota na UI. */
  status: HealthStatus;
  statusLabel: string;
  statusMeaning: string;
  /** Resposta direta à pergunta "posso rodar hoje?". */
  canRideAnswer: string;
}

export interface NextMaintenanceSnapshot {
  scheduleId: string;
  name: string;
  remainingLabel: string; // ex.: "Faltam 4 horas"
  status: "ok" | "soon" | "due" | "overdue";
}

export interface QuickStats {
  hoursTotal: number;
  kmTotal: number;
  lastActivityAt: string | null;
  lastActivityTitle: string | null;
  totalCost: number;
}

export type NextActionKind =
  | "register_maintenance"
  | "review_plan"
  | "renew_document"
  | "register_activity"
  | "add_photo";

export interface NextAction {
  kind: NextActionKind;
  label: string;         // CTA visível
  reason: string;        // motivo curto
  scheduleId?: string;   // se aplicável
}

export interface AlertSnapshot {
  label: string;
  tone: Exclude<Tone, "good">;
}

export interface CockpitSnapshot {
  motoId: string;
  isOwner: boolean;
  health: HealthSnapshot;
  nextMaintenance: NextMaintenanceSnapshot | null;
  stats: QuickStats;
  nextAlert: AlertSnapshot | null;
  nextAction: NextAction | null;
  components: ComponentView[];
  /** Frase curta e contextual do assistente TrailBook. */
  greeting: string;
  /** Plano de ação priorizado — todo diagnóstico gera recomendação. */
  actionPlan: ActionPlanItem[];
  /** Resumo curto do plano de ação. */
  actionSummary: string;
  /** Resposta oficial para "Posso rodar hoje?". */
  rideAnswer: RideAnswer;
}