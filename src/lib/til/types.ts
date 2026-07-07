import type { Database } from "@/integrations/supabase/types";
import type { ComponentView } from "./components";

export type Moto = Database["public"]["Tables"]["motorcycles"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type Schedule = Database["public"]["Tables"]["maintenance_schedules"]["Row"];
export type Attachment = Database["public"]["Tables"]["event_attachments"]["Row"];

export type Tone = "good" | "warn" | "bad";

export interface HealthSnapshot {
  score: number; // 0..100
  label: string; // frase única, ex.: "Sua moto está saudável"
  tone: Tone;
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
}