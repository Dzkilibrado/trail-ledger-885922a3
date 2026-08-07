import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { MAINT_CATEGORY_LABEL } from "@/lib/trailbook";
import {
  fetchDefaultTemplate,
  fetchTemplateItems,
  proposeSchedules,
  USE_PROFILES,
  ACTION_LABEL,
  SEVERITY_LABEL,
  type ProposedSchedule,
  type UseProfile,
  type PlanAction,
  type PlanSeverity,
} from "@/lib/plan-templates";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, Sparkles, CheckCircle2, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const searchSchema = z.object({ first: z.coerce.boolean().optional() });

export const Route = createFileRoute("/_authenticated/motorcycles/$id/plan")({
  head: () => ({ meta: [{ title: "Plano de manutenção — TrailBook" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: PlanWizard,
});

function PlanWizard() {
  const { id } = Route.useParams();
  const { first } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () =>
      (await supabase.from("motorcycles").select("*").eq("id", id).single()).data,
  });

  const [profile, setProfile] = useState<UseProfile>("normal");
  const [profileNote, setProfileNote] = useState("");
  const [rows, setRows] = useState<ProposedSchedule[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Perfil inicial vem da moto (se já preenchido).
  useEffect(() => {
    if (!moto.data || loaded) return;
    const p = (moto.data as any).use_profile as UseProfile | null;
    if (p) setProfile(p);
    if ((moto.data as any).use_profile_note) setProfileNote((moto.data as any).use_profile_note);
  }, [moto.data, loaded]);

  async function loadTemplate(withProfile: UseProfile) {
    const t = await fetchDefaultTemplate((moto.data as any)?.brand, (moto.data as any)?.model);
    if (!t) {
      toast.error("Nenhum plano padrão disponível ainda.");
      setRows([]);
      setLoaded(true);
      return;
    }
    const items = await fetchTemplateItems(t.id);
    setRows(proposeSchedules(items, withProfile));
    setLoaded(true);
  }

  useEffect(() => {
    if (moto.data && !loaded) loadTemplate(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moto.data]);

  function reapplyProfile(next: UseProfile) {
    setProfile(next);
    // Reaplica multiplicadores a partir do template — descartando ajustes manuais.
    loadTemplate(next);
  }

  function updateRow(i: number, patch: Partial<ProposedSchedule>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function addRow() {
    setRows((r) => [
      ...r,
      {
        key: `custom-${Date.now()}`,
        item_name: "",
        name: "Novo item — Inspecionar",
        category: "other",
        action: "inspect",
        severity: "medium",
        interval_hours: 20,
        interval_km: null,
        interval_days: null,
        notes: null,
        keep: true,
        sort_order: 999,
      },
    ]);
  }

  async function confirmPlan() {
    if (!moto.data) return;
    const active = rows.filter((r) => r.keep && r.item_name.trim());
    if (active.length === 0) return toast.error("Nenhum item selecionado.");
    for (const r of active) {
      if (!r.interval_hours && !r.interval_km && !r.interval_days) {
        return toast.error(`Informe pelo menos um intervalo para "${r.item_name}".`);
      }
    }
    setSaving(true);
    try {
      // Grava perfil de uso na moto
      const { error: motoErr } = await supabase
        .from("motorcycles")
        .update({
          use_profile: profile,
          use_profile_note: profile === "other" ? profileNote.trim() || null : null,
          // Após confirmar o plano, a revisão passa a "reviewed" — silencia o banner.
          plan_review_status: "reviewed",
        } as never)
        .eq("id", id);
      if (motoErr) throw motoErr;

      const payload = active.map((r) => ({
        motorcycle_id: id,
        name: r.name,
        category: r.category,
        interval_hours: r.interval_hours,
        interval_km: r.interval_km,
        interval_days: r.interval_days,
        // Vínculo estruturado ao item do catálogo. Rows customizadas
        // (key === "custom-*") não têm origem no template.
        template_item_id: r.key.startsWith("custom-") ? null : r.key,
      }));
      const { error } = await supabase.from("maintenance_schedules").insert(payload as never);
      if (error) throw error;
      toast.success("Plano de manutenção aplicado.");
      qc.invalidateQueries({ queryKey: ["motorcycle", id] });
      nav({ to: "/motorcycles/$id", params: { id } });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar plano.");
    } finally {
      setSaving(false);
    }
  }

  async function markReviewed() {
    try {
      const { error } = await supabase
        .from("motorcycles")
        .update({
          plan_review_status: "reviewed",
        } as never)
        .eq("id", id);
      if (error) throw error;
      toast.success("Revisão concluída. O banner será removido.");
      qc.invalidateQueries({ queryKey: ["motorcycle", id] });
      nav({ to: "/motorcycles/$id", params: { id } });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao marcar revisão.");
    }
  }

  const totals = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.keep).length,
    }),
    [rows],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Plano de manutenção sugerido"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: (moto.data as any)?.nickname || (moto.data as any)?.model || "Moto" },
          { label: "Plano" },
        ]}
        description={
          first
            ? "Revise os intervalos sugeridos para começar. Você pode ajustar antes de confirmar."
            : "Aplique um novo cronograma padrão a esta moto."
        }
      />

      {(moto.data as any)?.condition === "used" &&
        (moto.data as any)?.plan_review_status === "pending" && (
          <div className="surface-elevated rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <div className="font-semibold text-amber-200">Revisão inicial pendente</div>
                  <p className="text-xs text-amber-100/80">
                    Como esta moto já possui uso anterior, revise os itens de manutenção antes de
                    ativar os alertas. Ao confirmar o plano, a revisão é concluída automaticamente.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={markReviewed}>
                <CheckCircle2 className="h-4 w-4" /> Marcar revisão concluída
              </Button>
            </div>
          </div>
        )}

      {/* Perfil de uso */}
      <section className="surface-elevated rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">Perfil de uso</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Tipo de uso
            </Label>
            <Select value={profile} onValueChange={(v) => reapplyProfile(v as UseProfile)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USE_PROFILES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {USE_PROFILES.find((p) => p.value === profile)?.hint}
            </p>
          </div>
          {profile === "other" && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Descreva o uso *
              </Label>
              <Input
                value={profileNote}
                onChange={(e) => setProfileNote(e.target.value)}
                placeholder="ex: uso comercial em fazenda"
              />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
          Vida útil estimada da moto:
          <strong className="ml-1">
            {profile === "light" ? "120–180 h" : profile === "normal" ? "80–120 h" : "40–80 h"}
          </strong>{" "}
          — valores de referência para off-road. Não substituem inspeção técnica.
        </div>
      </section>

      {/* Itens */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Itens sugeridos</h2>
            <p className="text-xs text-muted-foreground">
              {totals.active} de {totals.total} itens ativos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => loadTemplate(profile)}>
              <Wand2 className="h-3.5 w-3.5" /> Reaplicar sugestão
            </Button>
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" /> Adicionar item
            </Button>
          </div>
        </div>

        {!loaded ? (
          <div className="text-sm text-muted-foreground">Carregando plano padrão…</div>
        ) : rows.length === 0 ? (
          <div className="surface-elevated rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Nenhum item disponível. Adicione manualmente ou volte à moto.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={r.key}
                className={`surface-elevated rounded-2xl p-4 ${!r.keep ? "opacity-50" : ""}`}
              >
                <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <div className="flex items-start pt-1">
                    <Checkbox
                      checked={r.keep}
                      onCheckedChange={(v) => updateRow(i, { keep: !!v })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr]">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Item
                        </Label>
                        <Input
                          value={r.item_name}
                          onChange={(e) =>
                            updateRow(i, {
                              item_name: e.target.value,
                              name: `${e.target.value} — ${ACTION_LABEL[r.action]}`,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Categoria
                        </Label>
                        <Select
                          value={r.category}
                          onValueChange={(v) => updateRow(i, { category: v as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(MAINT_CATEGORY_LABEL).map(([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Ação
                        </Label>
                        <Select
                          value={r.action}
                          onValueChange={(v) =>
                            updateRow(i, {
                              action: v as PlanAction,
                              name: `${r.item_name} — ${ACTION_LABEL[v as PlanAction]}`,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ACTION_LABEL).map(([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr]">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          A cada (h)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={r.interval_hours ?? ""}
                          onChange={(e) =>
                            updateRow(i, {
                              interval_hours: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          A cada (km)
                        </Label>
                        <Input
                          type="number"
                          value={r.interval_km ?? ""}
                          onChange={(e) =>
                            updateRow(i, {
                              interval_km: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          A cada (dias)
                        </Label>
                        <Input
                          type="number"
                          value={r.interval_days ?? ""}
                          onChange={(e) =>
                            updateRow(i, {
                              interval_days: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Severidade
                        </Label>
                        <Select
                          value={r.severity}
                          onValueChange={(v) => updateRow(i, { severity: v as PlanSeverity })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SEVERITY_LABEL).map(([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {r.notes && (
                      <Textarea
                        rows={2}
                        value={r.notes}
                        onChange={(e) => updateRow(i, { notes: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="flex items-start justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(i)}
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link to="/motorcycles/$id" params={{ id }}>
            Pular por agora
          </Link>
        </Button>
        <Button className="btn-glow" onClick={confirmPlan} disabled={saving || !loaded}>
          {saving ? "Salvando…" : "Confirmar plano de manutenção"}
        </Button>
      </div>
    </div>
  );
}
