import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import type { Motorcycle } from "@/lib/trailbook";
import { MAINT_CATEGORY_LABEL } from "@/lib/trailbook";
import {
  fetchDefaultTemplate, fetchTemplateItems, proposeSchedules,
  USE_PROFILE_MULTIPLIER, ACTION_LABEL,
  type UseProfile, type ProposedSchedule,
} from "@/lib/plan-templates";

/**
 * Atualiza o plano de manutenção de uma moto adicionando apenas os itens
 * do catálogo padrão que ainda não estão presentes.
 *
 * Regras de segurança:
 *   - NÃO altera schedules existentes (last_done_at, km, horas preservados).
 *   - NÃO apaga nada — apenas INSERT.
 *   - Compara por template_item_id (vínculo estruturado); nome é fallback.
 *   - Exibe pré-visualização; usuário escolhe quais itens adicionar.
 */
export function PlanCatalogSyncDialog({ moto, trigger }: { moto: Motorcycle; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const profile = ((moto as any).use_profile as UseProfile | null) ?? "normal";

  const data = useQuery({
    queryKey: ["plan-sync", moto.id, profile],
    enabled: open,
    queryFn: async () => {
      const t = await fetchDefaultTemplate(moto.brand, moto.model);
      if (!t) return { proposed: [] as ProposedSchedule[], existingIds: new Set<string>(), existingNames: new Set<string>() };
      const items = await fetchTemplateItems(t.id);
      const proposed = proposeSchedules(items, profile);
      const { data: existing } = await supabase
        .from("maintenance_schedules")
        .select("template_item_id, name")
        .eq("motorcycle_id", moto.id);
      const existingIds = new Set(
        (existing ?? []).map((e: any) => e.template_item_id).filter(Boolean) as string[],
      );
      const existingNames = new Set((existing ?? []).map((e: any) => (e.name as string)));
      return { proposed, existingIds, existingNames };
    },
  });

  const missing = useMemo(() => {
    if (!data.data) return [];
    return data.data.proposed.filter(
      (r) => !data.data!.existingIds.has(r.key) && !data.data!.existingNames.has(r.name),
    );
  }, [data.data]);

  const selectedCount = missing.filter((r) => checked[r.key] ?? true).length;

  async function apply() {
    setSaving(true);
    try {
      const rows = missing
        .filter((r) => checked[r.key] ?? true)
        .map((r) => ({
          motorcycle_id: moto.id,
          name: r.name,
          category: r.category,
          interval_hours: r.interval_hours,
          interval_km: r.interval_km,
          interval_days: r.interval_days,
          template_item_id: r.key,
        }));
      if (rows.length === 0) {
        setOpen(false);
        return;
      }
      const { error } = await supabase.from("maintenance_schedules").insert(rows as never);
      if (error) throw error;
      toast.success(`${rows.length} novo(s) item(ns) adicionado(s) ao plano. Nenhum registro existente foi alterado.`);
      setOpen(false);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao atualizar plano.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Atualizar plano com novos itens do catálogo
          </DialogTitle>
          <DialogDescription>
            O catálogo padrão foi atualizado. Adicione apenas o que está faltando — seus registros de manutenção (última execução, horas, km) não serão alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Perfil de uso da moto: <strong>{profile}</strong> (multiplicador ×{USE_PROFILE_MULTIPLIER[profile] ?? 1}).</span>
        </div>

        {data.isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Comparando catálogo…</div>
        ) : missing.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Seu plano já contém todos os itens do catálogo atual. Nada a adicionar.
          </div>
        ) : (
          <ul className="space-y-2">
            {missing.map((r) => {
              const on = checked[r.key] ?? true;
              return (
                <li key={r.key} className={`rounded-xl border border-border p-3 ${on ? "" : "opacity-50"}`}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) => setChecked((c) => ({ ...c, [r.key]: !!v }))}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.item_name}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {MAINT_CATEGORY_LABEL[r.category as keyof typeof MAINT_CATEGORY_LABEL]}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {ACTION_LABEL[r.action]} — a cada{" "}
                        {[r.interval_hours && `${r.interval_hours} h`, r.interval_km && `${r.interval_km} km`, r.interval_days && `${r.interval_days} dias`]
                          .filter(Boolean).join(" · ") || "—"}
                      </div>
                      {r.notes && <div className="mt-1 text-[11px] italic text-muted-foreground">{r.notes}</div>}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            className="btn-glow"
            onClick={apply}
            disabled={saving || missing.length === 0 || selectedCount === 0}
          >
            {saving ? "Aplicando…" : `Adicionar ${selectedCount} item(ns)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}