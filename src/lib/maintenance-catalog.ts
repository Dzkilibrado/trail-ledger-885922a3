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
 * v1.2.1 — Vínculo item→schedule EXCLUSIVAMENTE por identificador estruturado.
 *
 * Regra #10 do TrailBook: uma manutenção só pode atualizar um schedule
 * quando existe vínculo explícito. Nenhum matching por nome/substring é
 * feito aqui — nem mesmo por nome exato — porque o usuário pode ter
 * renomeado a programação, ter duplicatas ou usar catálogo diferente.
 *
 * Se `templateItemId` não casar com nenhum schedule ativo da moto,
 * retorna [] e a UI DEVE pedir seleção manual do(s) schedule(s) afetados.
 */
export async function findSchedulesForCatalogItem(
  motorcycleId: string,
  opts: { templateItemId?: string | null },
): Promise<string[]> {
  if (!opts.templateItemId) return [];
  const schedules = await fetchMotorcycleSchedules(motorcycleId);
  return schedules
    .filter((s) => s.template_item_id === opts.templateItemId)
    .map((s) => s.id);
}