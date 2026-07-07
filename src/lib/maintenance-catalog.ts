import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchDefaultTemplate, fetchTemplateItems, ACTION_LABEL } from "@/lib/plan-templates";

export type MaintenanceCategory = Database["public"]["Enums"]["maintenance_category"];

export interface CatalogEntry {
  id: string;              // template_item id
  item_name: string;       // "Óleo do motor"
  action: string;          // "replace"
  category: MaintenanceCategory;
  label: string;           // "Óleo do motor — Troca prevista"
  notes: string | null;
}

/**
 * Catálogo unificado de serviços de manutenção (SSOT).
 * Fonte única: maintenance_plan_items do template padrão (ou o mais específico
 * para a marca/modelo da moto). Consumido por Registrar atividade,
 * Plano de manutenção e integrações automáticas.
 */
export async function fetchMaintenanceCatalog(
  brand?: string | null,
  model?: string | null,
): Promise<CatalogEntry[]> {
  const t = await fetchDefaultTemplate(brand, model);
  if (!t) return [];
  const items = await fetchTemplateItems(t.id);
  return items.map((it) => ({
    id: it.id,
    item_name: it.item_name,
    action: it.action,
    category: it.category,
    label: `${it.item_name} — ${ACTION_LABEL[it.action]}`,
    notes: it.notes,
  }));
}

/**
 * Busca as programações ativas de uma moto — usado para casar um serviço
 * escolhido no catálogo com o schedule a atualizar automaticamente.
 */
export async function fetchMotorcycleSchedules(motorcycleId: string) {
  const { data } = await supabase
    .from("maintenance_schedules")
    .select("id, name, category, template_item_id")
    .eq("motorcycle_id", motorcycleId)
    .eq("active", true);
  return data ?? [];
}

/**
 * Localiza schedules candidatos para uma atividade.
 *   1. Preferência ABSOLUTA: vínculo por ID do item do catálogo (template_item_id).
 *   2. Fallback restrito: nome idêntico ao item_name OU exatamente "item_name — Ação".
 *
 * ATENÇÃO: nunca usar substring/`includes`. Isso replicaria o serviço em
 * schedules de outros itens (ex.: "óleo" bateria em "óleo do motor" e
 * "filtro de óleo") — o efeito colateral que a Fase 2 precisa eliminar.
 * Se nada casa exatamente, retorna [] e nenhuma programação é alterada.
 */
export async function findSchedulesForCatalogItem(
  motorcycleId: string,
  opts: { templateItemId?: string | null; itemName?: string | null },
): Promise<string[]> {
  const schedules = await fetchMotorcycleSchedules(motorcycleId);
  if (opts.templateItemId) {
    const byId = schedules.filter((s) => s.template_item_id === opts.templateItemId);
    if (byId.length > 0) return byId.map((s) => s.id);
  }
  const name = (opts.itemName ?? "").trim();
  if (!name) return [];
  const exact = schedules.filter(
    (s) => s.name === name || s.name.startsWith(`${name} —`),
  );
  return exact.map((s) => s.id);
}