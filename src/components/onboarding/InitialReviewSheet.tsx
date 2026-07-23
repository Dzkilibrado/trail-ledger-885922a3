import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ComponentIcon } from "@/components/components/componentIcon";
import { MAINT_CATEGORY_LABEL } from "@/lib/trailbook";
import { recomposeTimeline } from "@/lib/activity-recalc";

/**
 * InitialReviewSheet — "Você comprou uma moto usada?" no formato entrevista.
 * Um componente por vez. Sem obrigação de preencher.
 */
export function InitialReviewSheet({
  motoId,
  motoHours,
  motoKm,
  open,
  onOpenChange,
}: {
  motoId: string;
  motoHours: number;
  motoKm: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [informDate, setInformDate] = useState("");
  const [informHours, setInformHours] = useState("");
  const [informKm, setInformKm] = useState("");

  const schedules = useQuery({
    queryKey: ["schedules-initial-review", motoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_schedules")
        .select("id, name, category, status, last_done_at")
        .eq("motorcycle_id", motoId)
        .order("category");
      return data ?? [];
    },
    enabled: open,
  });

  const items = useMemo(() => (schedules.data ?? []).filter((s: any) => s.status !== "not_applicable"), [schedules.data]);
  const total = items.length;
  const current = items[step];

  function reset() {
    setInformDate(""); setInformHours(""); setInformKm("");
  }

  async function next() {
    reset();
    if (step + 1 >= total) {
      await finish();
    } else {
      setStep(step + 1);
    }
  }

  async function saveInform() {
    if (!current) return;
    setSaving(true);
    const patch: Record<string, unknown> = {
      status: "active",
      last_done_at: informDate ? new Date(informDate).toISOString() : new Date().toISOString(),
      last_done_hours: informHours ? Number(informHours) : motoHours,
      last_done_km: informKm ? Number(informKm) : motoKm,
    };
    const { error } = await supabase.from("maintenance_schedules").update(patch as never).eq("id", (current as any).id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await next();
  }

  async function saveNoInfo() {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase.from("maintenance_schedules").update({ status: "no_info" } as never).eq("id", (current as any).id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await next();
  }

  async function saveNotApplicable() {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase.from("maintenance_schedules").update({ status: "not_applicable" } as never).eq("id", (current as any).id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await next();
  }

  async function finish() {
    setSaving(true);
    await supabase.from("motorcycles").update({
      initial_review_done_at: new Date().toISOString(),
      plan_review_status: "reviewed",
    } as never).eq("id", motoId);
    try { await recomposeTimeline(motoId); } catch { /* recomposição defensiva */ }
    setSaving(false);
    toast.success("Revisão inicial concluída.");
    qc.invalidateQueries();
    onOpenChange(false);
    setStep(0);
  }

  /**
   * Atalho para o cenário "revisei a moto inteira agora": marca TODOS os
   * componentes ainda pendentes como revisados no horímetro/KM atuais e
   * conclui a revisão inicial em um único passo. Necessário para manter a
   * sincronia entre o que o usuário informa e o que Dashboard/Manutenção
   * exibem — sem isso, componentes ficam com last_done nulo e a tela de
   * Manutenção computa vencimentos a partir da baseline.
   */
  async function markAllRevisedNow() {
    setSaving(true);
    const ids = items
      .filter((s: any) => s.status !== "not_applicable")
      .map((s: any) => s.id as string);
    if (ids.length > 0) {
      const patch = {
        status: "active",
        last_done_at: new Date().toISOString(),
        last_done_hours: motoHours,
        last_done_km: motoKm,
      };
      await supabase.from("maintenance_schedules").update(patch as never).in("id", ids);
    }
    await finish();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto sm:max-w-lg sm:mx-auto sm:rounded-t-3xl">
        <SheetHeader className="text-left">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Revisão inicial · {Math.min(step + 1, Math.max(total, 1))} de {total}
          </div>
          <SheetTitle className="font-display text-xl">Vamos entender o estado da sua moto</SheetTitle>
          <SheetDescription>Responda uma pergunta por vez. Você pode sair a qualquer momento.</SheetDescription>
        </SheetHeader>

        {schedules.isLoading || !current ? (
          <div className="mt-6 space-y-3">
            {total === 0 && !schedules.isLoading
              ? <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum componente para revisar.
                </div>
              : Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-card" />)}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Atalho oficial: quem revisou a moto inteira agora conclui em 1 toque. */}
            <button
              type="button"
              onClick={markAllRevisedNow}
              disabled={saving}
              className="w-full rounded-2xl border border-primary/40 bg-primary/10 p-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
            >
              Já revisei a moto inteira agora ({motoHours.toFixed(1)} h · {motoKm.toFixed(0)} km)
            </button>

            {/* Progress */}
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${((step) / total) * 100}%` }} />
            </div>

            {/* Pergunta */}
            <div className="surface-elevated rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
                  <ComponentIcon category={(current as any).category} className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {MAINT_CATEGORY_LABEL[(current as any).category as keyof typeof MAINT_CATEGORY_LABEL]}
                  </div>
                  <div className="truncate font-medium">{(current as any).name}</div>
                </div>
              </div>
              <p className="mt-4 text-sm">
                Você sabe quando esse componente foi revisado pela última vez?
              </p>

              <div className="mt-4 grid gap-2">
                <Button variant="outline" className="justify-start" onClick={saveNoInfo} disabled={saving}>
                  Não sei informar
                </Button>
                <Button variant="ghost" className="justify-start" onClick={saveNotApplicable} disabled={saving}>
                  Este componente não se aplica à minha moto
                </Button>
              </div>

              <details className="mt-4 rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Sei informar</summary>
                <div className="mt-3 space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data (opcional)</Label>
                    <Input type="date" value={informDate} onChange={(e) => setInformDate(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Horímetro (h)</Label>
                      <Input type="number" step="0.1" placeholder={motoHours.toFixed(1)} value={informHours} onChange={(e) => setInformHours(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">KM</Label>
                      <Input type="number" placeholder={motoKm.toFixed(0)} value={informKm} onChange={(e) => setInformKm(e.target.value)} />
                    </div>
                  </div>
                  <Button className="btn-glow w-full" onClick={saveInform} disabled={saving}>
                    Salvar e continuar
                  </Button>
                </div>
              </details>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Terminar depois</Button>
              <Button variant="ghost" size="sm" onClick={next} disabled={saving}>
                Pular componente
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}