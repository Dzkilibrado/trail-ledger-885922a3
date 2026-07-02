import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type UseProfile = Database["public"]["Enums"]["use_profile"];
export type PlanAction = Database["public"]["Enums"]["plan_item_action"];
export type PlanSeverity = Database["public"]["Enums"]["plan_severity"];
export type PlanTemplate = Database["public"]["Tables"]["maintenance_plan_templates"]["Row"];
export type PlanItem = Database["public"]["Tables"]["maintenance_plan_items"]["Row"];
export type WearSign = Database["public"]["Tables"]["maintenance_wear_signs"]["Row"];

export const USE_PROFILES: { value: UseProfile; label: string; hint: string }[] = [
  { value: "light", label: "Uso leve", hint: "Passeio esporádico, terreno fácil." },
  { value: "normal", label: "Trilha / Enduro normal", hint: "Uso regular em trilhas variadas." },
  { value: "severe", label: "Uso severo", hint: "Trilhas técnicas, longas, sem pausa." },
  { value: "motocross", label: "Motocross", hint: "Pista, saltos e alta rotação." },
  { value: "competition", label: "Competição", hint: "Provas, treinos intensos." },
  { value: "sand_mud", label: "Areia / lama intensa", hint: "Alto desgaste de transmissão e freios." },
  { value: "other", label: "Outro", hint: "Descreva no campo ao lado." },
];

/** Multiplicador aplicado a intervalos de inspeção e troca conforme o perfil de uso. */
export const USE_PROFILE_MULTIPLIER: Record<UseProfile, number> = {
  light: 1.5,
  normal: 1.0,
  severe: 0.7,
  motocross: 0.6,
  competition: 0.5,
  sand_mud: 0.6,
  other: 1.0,
};

export const ACTION_LABEL: Record<PlanAction, string> = {
  inspect: "Inspecionar",
  replace: "Troca prevista",
  lubricate: "Lubrificar",
  adjust: "Ajustar",
  clean: "Limpar",
  check_level: "Verificar nível",
};

export const SEVERITY_LABEL: Record<PlanSeverity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export interface ProposedSchedule {
  key: string;
  name: string;               // "Corrente — Lubrificar"
  category: PlanItem["category"];
  action: PlanAction;
  severity: PlanSeverity;
  interval_hours: number | null;
  interval_km: number | null;
  interval_days: number | null;
  notes: string | null;
  keep: boolean;
  item_name: string;
  sort_order: number;
}

export async function fetchDefaultTemplate(brand?: string | null, model?: string | null) {
  // Busca o mais específico primeiro; cai no is_default.
  const q = await supabase.from("maintenance_plan_templates").select("*").eq("active", true);
  if (q.error || !q.data) return null;
  const list = q.data;
  const byModel = model ? list.find((t) => t.brand === brand && t.model === model) : null;
  const byBrand = brand ? list.find((t) => t.brand === brand && !t.model) : null;
  const def = list.find((t) => t.is_default);
  return byModel ?? byBrand ?? def ?? null;
}

export async function fetchTemplateItems(templateId: string) {
  const { data } = await supabase
    .from("maintenance_plan_items")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");
  return data ?? [];
}

export async function fetchWearSigns() {
  const { data } = await supabase.from("maintenance_wear_signs").select("*").order("sort_order");
  return data ?? [];
}

/** Aplica o multiplicador de perfil de uso e monta a lista de programações propostas. */
export function proposeSchedules(items: PlanItem[], profile: UseProfile): ProposedSchedule[] {
  const mul = USE_PROFILE_MULTIPLIER[profile] ?? 1;
  const round = (n: number | null | undefined) =>
    n == null ? null : Math.max(1, Math.round(Number(n) * mul));
  return items.map((it) => {
    const isReplace = it.action === "replace";
    return {
      key: it.id,
      item_name: it.item_name,
      name: `${it.item_name} — ${ACTION_LABEL[it.action]}`,
      category: it.category,
      action: it.action,
      severity: it.severity,
      interval_hours: round(isReplace ? it.replace_hours : it.interval_hours),
      interval_km: round(isReplace ? it.replace_km : it.interval_km),
      interval_days: round(isReplace ? it.replace_days : it.interval_days),
      notes: it.notes,
      keep: true,
      sort_order: it.sort_order,
    };
  });
}