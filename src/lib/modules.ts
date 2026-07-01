export type ModuleStatus = "active" | "maintenance" | "disabled" | "beta";

export interface PlatformModule {
  id: string;
  key: string;
  label: string;
  description: string | null;
  status: ModuleStatus;
  maintenance_message: string | null;
  maintenance_until: string | null;
  maintenance_reason: string | null;
  hide_when_disabled: boolean;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export const STATUS_META: Record<ModuleStatus, { label: string; emoji: string; tone: string }> = {
  active: { label: "Ativo", emoji: "🟢", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  maintenance: { label: "Em manutenção", emoji: "🚧", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  disabled: { label: "Desabilitado", emoji: "🔒", tone: "bg-muted text-muted-foreground border-border" },
  beta: { label: "Beta", emoji: "🧪", tone: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
};

/** Maps navigation route paths to a module key. Keep in sync with sidebar NAV. */
export const ROUTE_TO_MODULE: Record<string, string> = {
  "/dashboard": "dashboard",
  "/motorcycles": "motorcycles",
  "/documents": "documents",
  "/agenda": "agenda",
  "/workshops": "workshops",
  "/financial": "financial",
  "/certificates": "certificates",
  "/transfers": "transfers",
  "/tickets": "tickets",
  "/plans": "plans",
};