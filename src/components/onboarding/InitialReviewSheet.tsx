import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ComponentIcon } from "@/components/components/componentIcon";
import { MAINT_CATEGORY_LABEL } from "@/lib/trailbook";
import { recomposeTimeline } from "@/lib/activity-recalc";
import { TBDialog } from "@/design-system/overlays/TBDialog";
import { reviewStateMessage } from "@/lib/review-state";
import { ACTION_LABEL, type PlanAction } from "@/lib/plan-templates";

// ──────────────────────────────────────────────────────────────────────────────
// Constantes de classificação por ação
// ──────────────────────────────────────────────────────────────────────────────

/** Ações que representam inspeção/verificação — podem receber baseline
 *  automaticamente quando o usuário confirma "Revisei a moto inteira". */
const INSPECTION_ACTIONS = new Set<PlanAction>(["inspect", "check_level"]);

/** Ações físicas — NUNCA recebem baseline sem confirmação explícita. */
const PHYSICAL_ACTIONS = new Set<PlanAction>(["lubricate", "adjust", "clean", "replace"]);

function classifyAction(action: PlanAction | null | undefined): "inspection" | "physical" | "unknown" {
  if (!action) return "unknown";
  if (INSPECTION_ACTIONS.has(action)) return "inspection";
  if (PHYSICAL_ACTIONS.has(action)) return "physical";
  return "unknown";
}

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────

interface ScheduleWithAction {
  id: string;
  name: string;
  category: string;
  status: string;
  last_done_at: string | null;
  last_done_hours: number | null;
  last_done_km: number | null;
  template_item_id: string | null;
  /** Ação obtida via JOIN com maintenance_plan_items */
  action?: PlanAction | null;
  /** Classificação derivada */
  kind?: "inspection" | "physical" | "unknown";
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────────

/**
 * InitialReviewSheet — "Você comprou uma moto usada?" no formato entrevista.
 *
 * REGRAS DE SEMÂNTICA:
 * - Ações inspect/check_level → podem receber baseline automático na revisão geral
 * - Ações lubricate/adjust/clean/replace → NUNCA recebem baseline sem confirmação
 * - Schedules sem template_item_id → tratados como "unknown" (sem baseline auto)
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
  const [successOpen, setSuccessOpen] = useState(false);
  const [forceInterview, setForceInterview] = useState(false);
  const [informDate, setInformDate] = useState("");
  const [informHours, setInformHours] = useState("");
  const [informKm, setInformKm] = useState("");

  // Segundo passo após "Revisei a moto inteira": quais serviços físicos foram realizados
  const [showServiceStep, setShowServiceStep] = useState(false);
  const [confirmedServices, setConfirmedServices] = useState<Set<string>>(new Set());

  // Resultado da revisão geral para o dialog de sucesso
  const [reviewSummary, setReviewSummary] = useState<{
    inspections: number;
    services: number;
  } | null>(null);

  // ── Dados ──────────────────────────────────────────────────────────────────

  const schedules = useQuery({
    queryKey: ["schedules-initial-review", motoId],
    queryFn: async () => {
      // Busca schedules com template_item_id para JOIN via maintenance_plan_items
      const { data: sched } = await supabase
        .from("maintenance_schedules")
        .select(
          "id, name, category, status, last_done_at, last_done_hours, last_done_km, template_item_id",
        )
        .eq("motorcycle_id", motoId)
        .order("category");
      if (!sched) return [];

      // Busca as ações dos templates para os schedules que têm template_item_id
      const templateIds = [...new Set(sched.map((s) => s.template_item_id).filter(Boolean))] as string[];
      let actionMap: Record<string, PlanAction> = {};
      if (templateIds.length > 0) {
        const { data: planItems } = await supabase
          .from("maintenance_plan_items")
          .select("id, action")
          .in("id", templateIds);
        if (planItems) {
          actionMap = Object.fromEntries(planItems.map((p) => [p.id, p.action as PlanAction]));
        }
      }

      return sched.map((s): ScheduleWithAction => {
        const action = s.template_item_id ? (actionMap[s.template_item_id] ?? null) : null;
        return { ...s, action, kind: classifyAction(action) };
      });
    },
    enabled: open,
  });

  const items = useMemo(
    () => (schedules.data ?? []).filter((s) => s.status !== "not_applicable"),
    [schedules.data],
  );
  const total = items.length;
  const current = items[step];

  // Schedules classificados por tipo
  const inspectionItems = useMemo(
    () => items.filter((s) => s.kind === "inspection"),
    [items],
  );
  const physicalItems = useMemo(
    () => items.filter((s) => s.kind === "physical" || s.kind === "unknown"),
    [items],
  );

  const readyToComplete = useMemo(() => {
    if (total === 0) return false;
    return items.every(
      (s) => !!(s.last_done_at || s.last_done_hours != null || s.last_done_km != null),
    );
  }, [items, total]);

  const confirmedCount = useMemo(
    () =>
      items.filter(
        (s) => !!(s.last_done_at || s.last_done_hours != null || s.last_done_km != null),
      ).length,
    [items],
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  function reset() {
    setInformDate("");
    setInformHours("");
    setInformKm("");
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
    const patch = {
      status: "active",
      last_done_at: informDate ? new Date(informDate).toISOString() : new Date().toISOString(),
      last_done_hours: informHours ? Number(informHours) : motoHours,
      last_done_km: informKm ? Number(informKm) : motoKm,
    };
    const { error } = await supabase
      .from("maintenance_schedules")
      .update(patch as never)
      .eq("id", (current as any).id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await next();
  }

  async function saveNoInfo() {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase
      .from("maintenance_schedules")
      .update({ status: "no_info" } as never)
      .eq("id", (current as any).id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await next();
  }

  async function saveNotApplicable() {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase
      .from("maintenance_schedules")
      .update({ status: "not_applicable" } as never)
      .eq("id", (current as any).id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await next();
  }

  // ── Revisão geral — step 1: registrar inspeções ────────────────────────────

  async function startMarkAllRevised() {
    setSaving(true);

    // SOMENTE ações de inspeção/verificação recebem baseline automático
    const inspectionIds = inspectionItems.map((s) => s.id);
    const now = new Date().toISOString();
    const patch = {
      status: "active",
      last_done_at: now,
      last_done_hours: motoHours,
      last_done_km: motoKm,
    };

    if (inspectionIds.length > 0) {
      const { error } = await supabase
        .from("maintenance_schedules")
        .update(patch as never)
        .in("id", inspectionIds);
      if (error) {
        setSaving(false);
        toast.error("Não foi possível registrar as inspeções.", { description: error.message });
        return;
      }
    }

    // Refresca os dados locais
    await schedules.refetch();
    setSaving(false);

    // Pergunta se serviços físicos também foram realizados
    setConfirmedServices(new Set());
    setShowServiceStep(true);
  }

  // ── Revisão geral — step 2: registrar serviços físicos confirmados ─────────

  async function confirmServices() {
    setSaving(true);
    const now = new Date().toISOString();
    const patch = {
      status: "active",
      last_done_at: now,
      last_done_hours: motoHours,
      last_done_km: motoKm,
    };

    if (confirmedServices.size > 0) {
      const { error } = await supabase
        .from("maintenance_schedules")
        .update(patch as never)
        .in("id", [...confirmedServices]);
      if (error) {
        setSaving(false);
        toast.error("Não foi possível registrar os serviços.", { description: error.message });
        return;
      }
    }

    setReviewSummary({
      inspections: inspectionItems.length,
      services: confirmedServices.size,
    });

    await finishAfterServices();
  }

  async function finishAfterServices() {
    setSaving(true);
    const { error } = await supabase
      .from("motorcycles")
      .update({
        initial_review_done_at: new Date().toISOString(),
        plan_review_status: "reviewed",
      } as never)
      .eq("id", motoId);
    if (error) {
      setSaving(false);
      toast.error("Não foi possível confirmar a revisão", { description: error.message });
      return;
    }
    try {
      await recomposeTimeline(motoId);
    } catch {
      /* defensivo */
    }
    setSaving(false);
    setShowServiceStep(false);
    await qc.invalidateQueries();
    setSuccessOpen(true);
    setStep(0);
    setForceInterview(false);
  }

  // ── Conclusão via entrevista (caminho item a item) ─────────────────────────

  async function finish() {
    setSaving(true);
    const { error } = await supabase
      .from("motorcycles")
      .update({
        initial_review_done_at: new Date().toISOString(),
        plan_review_status: "reviewed",
      } as never)
      .eq("id", motoId);
    if (error) {
      setSaving(false);
      toast.error("Não foi possível confirmar a revisão", { description: error.message });
      return;
    }
    try {
      await recomposeTimeline(motoId);
    } catch {
      /* defensivo */
    }
    setSaving(false);
    await qc.invalidateQueries();
    setSuccessOpen(true);
    setStep(0);
    setForceInterview(false);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto sm:max-w-lg sm:mx-auto sm:rounded-t-3xl"
        >
          {/* ── Etapa 2: serviços físicos realizados ── */}
          {showServiceStep ? (
            <>
              <SheetHeader className="text-left">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Revisão inicial · Serviços realizados
                </div>
                <SheetTitle className="font-display text-xl">
                  Algum serviço também foi realizado?
                </SheetTitle>
                <SheetDescription>
                  As inspeções já foram registradas. Marque abaixo somente os serviços que
                  efetivamente foram realizados durante esta revisão.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-3">
                {physicalItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço físico pendente encontrado.
                  </p>
                ) : (
                  physicalItems.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={confirmedServices.has(s.id)}
                        onChange={(e) => {
                          setConfirmedServices((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          });
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {MAINT_CATEGORY_LABEL[s.category as keyof typeof MAINT_CATEGORY_LABEL]}
                          {s.action && (
                            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              {ACTION_LABEL[s.action as keyof typeof ACTION_LABEL]}
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                  ))
                )}

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => { setConfirmedServices(new Set()); confirmServices(); }}
                    disabled={saving}
                  >
                    Não, apenas revisei
                  </Button>
                  <Button
                    className="btn-glow"
                    onClick={confirmServices}
                    disabled={saving || confirmedServices.size === 0}
                  >
                    Registrar {confirmedServices.size > 0 ? `${confirmedServices.size} serviço(s)` : "serviços"}
                  </Button>
                </div>
              </div>
            </>
          ) : readyToComplete && !forceInterview ? (
            /* ── Conclusão da entrevista ── */
            <>
              <SheetHeader className="text-left">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Revisão inicial
                </div>
                <SheetTitle className="font-display text-xl">
                  Revisão pronta para concluir
                </SheetTitle>
                <SheetDescription>
                  Todos os componentes possuem informações registradas. Confirme a conclusão para
                  que o TrailBook registre este momento como o início oficial do acompanhamento da
                  motocicleta.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="surface-elevated rounded-2xl p-4 space-y-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Resumo da confirmação
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Componentes</dt>
                      <dd className="font-medium">{total}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Confirmados</dt>
                      <dd className="font-medium">{confirmedCount} de {total}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Horímetro atual</dt>
                      <dd className="font-medium">{motoHours.toFixed(1)} h</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">KM atual</dt>
                      <dd className="font-medium">{motoKm.toFixed(0)} km</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Data que será registrada</dt>
                      <dd className="font-medium">{new Date().toLocaleDateString("pt-BR")}</dd>
                    </div>
                  </dl>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
                    Nenhum componente está pendente. As informações já registradas serão preservadas
                    — nada será sobrescrito.
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setForceInterview(true)} disabled={saving}>
                    Voltar e revisar
                  </Button>
                  <Button className="btn-glow" onClick={finish} disabled={saving}>
                    Confirmar conclusão
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* ── Entrevista item a item ── */
            <>
              <SheetHeader className="text-left">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Revisão inicial · {Math.min(step + 1, Math.max(total, 1))} de {total}
                </div>
                <SheetTitle className="font-display text-xl">
                  Vamos entender o estado da sua moto
                </SheetTitle>
                <SheetDescription>
                  Responda uma pergunta por vez. Você pode sair a qualquer momento.
                </SheetDescription>
              </SheetHeader>

              {schedules.isLoading || !current ? (
                <div className="mt-6 space-y-3">
                  {total === 0 && !schedules.isLoading ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Nenhum componente para revisar.
                    </div>
                  ) : (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-2xl bg-card" />
                    ))
                  )}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {/* Atalho: revisão geral */}
                  <button
                    type="button"
                    onClick={startMarkAllRevised}
                    disabled={saving}
                    className="w-full rounded-2xl border border-primary/40 bg-primary/10 p-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                  >
                    Já revisei a moto inteira agora ({motoHours.toFixed(1)} h · {motoKm.toFixed(0)} km)
                  </button>

                  {/* Progress */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(step / total) * 100}%` }}
                    />
                  </div>

                  {/* Pergunta */}
                  <div className="surface-elevated rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
                        <ComponentIcon
                          category={(current as any).category}
                          className="h-6 w-6 text-primary"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          {MAINT_CATEGORY_LABEL[(current as any).category as keyof typeof MAINT_CATEGORY_LABEL]}
                        </div>
                        <div className="truncate font-medium">{(current as any).name}</div>
                        {(current as ScheduleWithAction).kind === "physical" && (
                          <div className="mt-0.5 text-[10px] text-amber-400 font-medium">
                            ⚠ Serviço físico — requer confirmação específica
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mt-4 text-sm">
                      Você sabe quando esse componente foi revisado pela última vez?
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={saveNoInfo}
                        disabled={saving}
                      >
                        Não sei informar
                      </Button>
                      <Button
                        variant="ghost"
                        className="justify-start"
                        onClick={saveNotApplicable}
                        disabled={saving}
                      >
                        Este componente não se aplica à minha moto
                      </Button>
                    </div>

                    <details className="mt-4 rounded-xl border border-border p-3">
                      <summary className="cursor-pointer text-sm font-medium">Sei informar</summary>
                      <div className="mt-3 space-y-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Data (opcional)</Label>
                          <Input
                            type="date"
                            value={informDate}
                            onChange={(e) => setInformDate(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Horímetro (h)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder={motoHours.toFixed(1)}
                              value={informHours}
                              onChange={(e) => setInformHours(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">KM</Label>
                            <Input
                              type="number"
                              placeholder={motoKm.toFixed(0)}
                              value={informKm}
                              onChange={(e) => setInformKm(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button className="btn-glow w-full" onClick={saveInform} disabled={saving}>
                          Salvar e continuar
                        </Button>
                      </div>
                    </details>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                      Terminar depois
                    </Button>
                    <Button variant="ghost" size="sm" onClick={next} disabled={saving}>
                      Pular componente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de sucesso */}
      <TBDialog
        open={successOpen}
        onOpenChange={(v) => {
          setSuccessOpen(v);
          if (!v) onOpenChange(false);
        }}
        title="Revisão registrada"
        description={
          reviewSummary
            ? `Revisão registrada em ${motoHours.toFixed(1)} h. Inspeções: ${reviewSummary.inspections}. Serviços realizados: ${reviewSummary.services}. ${reviewStateMessage("fully_reviewed")} Os próximos vencimentos serão calculados a partir desta leitura.`
            : `${reviewStateMessage("fully_reviewed")} Os próximos vencimentos serão calculados a partir de ${motoHours.toFixed(1)} h.`
        }
        footer={
          <Button
            className="btn-glow w-full sm:w-auto"
            onClick={() => {
              setSuccessOpen(false);
              onOpenChange(false);
            }}
          >
            Continuar
          </Button>
        }
      />
    </>
  );
}
