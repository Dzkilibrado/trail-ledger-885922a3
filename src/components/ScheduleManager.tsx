import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAINTENANCE_PRESETS } from "@/lib/maintenance-presets";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory } from "@/lib/trailbook";
import { Settings2, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ScheduleManager({ motoId }: { motoId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const schedules = useQuery({
    queryKey: ["schedules", motoId],
    queryFn: async () => (await supabase.from("maintenance_schedules").select("*").eq("motorcycle_id", motoId).order("name")).data ?? [],
    enabled: open,
  });

  async function addPreset(presetKey: string) {
    const p = MAINTENANCE_PRESETS.find((x) => x.key === presetKey);
    if (!p) return;
    const { error } = await supabase.from("maintenance_schedules").insert({
      motorcycle_id: motoId,
      name: p.name,
      category: p.category,
      interval_hours: p.interval_hours ?? null,
      interval_km: p.interval_km ?? null,
      interval_days: p.interval_days ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Programação adicionada");
    qc.invalidateQueries({ queryKey: ["schedules"] });
    schedules.refetch();
  }

  async function addCustom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      motorcycle_id: motoId,
      name: String(fd.get("name") || "").trim(),
      category: String(fd.get("category") || "other") as MaintenanceCategory,
      interval_hours: fd.get("interval_hours") ? Number(fd.get("interval_hours")) : null,
      interval_km: fd.get("interval_km") ? Number(fd.get("interval_km")) : null,
      interval_days: fd.get("interval_days") ? Number(fd.get("interval_days")) : null,
    };
    if (!payload.name) return toast.error("Informe o nome do serviço");
    if (!payload.interval_hours && !payload.interval_km && !payload.interval_days) return toast.error("Informe pelo menos um intervalo (horas, km ou dias)");
    const { error } = await supabase.from("maintenance_schedules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Programação criada");
    qc.invalidateQueries({ queryKey: ["schedules"] });
    schedules.refetch();
    (e.target as HTMLFormElement).reset();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("maintenance_schedules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["schedules"] });
    schedules.refetch();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Settings2 className="h-4 w-4" /> Plano de manutenção</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Plano de manutenção</DialogTitle></DialogHeader>

        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Aplicar do catálogo</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {MAINTENANCE_PRESETS.map((p) => {
              const exists = schedules.data?.some((s) => s.name === p.name);
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={exists}
                  onClick={() => addPreset(p.key)}
                  className="surface-elevated flex items-start justify-between gap-2 rounded-xl p-3 text-left text-sm transition hover:border-primary/50 disabled:opacity-40"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {MAINT_CATEGORY_LABEL[p.category]} ·{" "}
                      {[p.interval_hours && `${p.interval_hours}h`, p.interval_km && `${p.interval_km}km`, p.interval_days && `${p.interval_days}d`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {exists ? <span className="text-xs text-muted-foreground">✓</span> : <Plus className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Programação personalizada</h3>
          <form onSubmit={addCustom} className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Nome do serviço</Label>
              <Input name="name" required placeholder="ex: Inspeção do pneu" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select name="category" defaultValue="other">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MAINT_CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <div className="space-y-1.5"><Label className="text-xs">A cada (h)</Label><Input name="interval_hours" type="number" step="0.1" /></div>
              <div className="space-y-1.5"><Label className="text-xs">A cada (km)</Label><Input name="interval_km" type="number" /></div>
              <div className="space-y-1.5"><Label className="text-xs">A cada (dias)</Label><Input name="interval_days" type="number" /></div>
            </div>
          <Button type="submit" className="sm:col-span-2 btn-glow"><Plus className="h-4 w-4" /> Adicionar programação</Button>
          </form>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Programações ativas</h3>
          {schedules.data && schedules.data.length > 0 ? (
            <ul className="space-y-2">
              {schedules.data.map((s) => (
                <li key={s.id} className="surface-elevated flex items-center justify-between rounded-xl p-3 text-sm">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {MAINT_CATEGORY_LABEL[s.category]} ·{" "}
                      {[s.interval_hours && `${s.interval_hours}h`, s.interval_km && `${s.interval_km}km`, s.interval_days && `${s.interval_days}d`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-destructive hover:opacity-80" aria-label="Excluir programação">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir esta programação de manutenção?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A programação <strong>{s.name}</strong> será removida. Esta ação <strong>não afeta a motocicleta nem o histórico</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir programação
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Nenhuma programação ainda.</div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}