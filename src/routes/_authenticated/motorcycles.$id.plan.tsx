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
  applyPlan,
  type ProposedSchedule,
  type UseProfile,
  type PlanAction,
  type PlanSeverity,
} from "@/lib/plan-templates";
import { toast } from "sonner";
import { PlanItemRow } from "@/components/PlanItemRow";
import {
  Plus,
  Trash2,
  Wand2,
  Sparkles,
  CheckCircle2,
  Info,
  ChevronDown,
  Pencil,
} from "lucide-react";
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
    setSaving(true);
    try {
      await applyPlan(supabase, id, rows, profile, profileNote);
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

  // --- Accordion: categorias abertas por estado local ---
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set());

  function toggleCat(cat: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // Agrupa rows por categoria (preservando índice global para updateRow/removeRow)
  const indexed = rows.map((r, i) => ({ r, i }));
  const cats = Object.keys(MAINT_CATEGORY_LABEL) as Array<keyof typeof MAINT_CATEGORY_LABEL>;
  const grouped = cats
    .map((cat) => ({
      cat,
      label: MAINT_CATEGORY_LABEL[cat],
      items: indexed.filter(({ r }) => r.category === cat),
    }))
    .filter(({ items }) => items.length > 0); // C: ocultar categorias vazias

  const activeCount = rows.filter((r) => r.keep).length;

  function intervalSummary(r: ProposedSchedule): string {
    const parts: string[] = [];
    if (r.interval_hours) parts.push(`${r.interval_hours} h`);
    if (r.interval_km) parts.push(`${r.interval_km} km`);
    if (r.interval_days) parts.push(`${r.interval_days} dias`);
    return parts.length ? `A cada ${parts.join(" · ")}` : "Sem intervalo definido";
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-32">
      {/* Cabeçalho */}
      <PageHeader
        title="Plano de manutenção sugerido"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: (moto.data as any)?.nickname || (moto.data as any)?.model || "Moto" },
          { label: "Plano" },
        ]}
        description="Preparamos uma sugestão inicial para você revisar e ajustar antes de confirmar."
      />

      {/* Banner revisão inicial — mantido exatamente como estava */}
      {(moto.data as any)?.plan_review_status === "pending" &&
        ((moto.data as any)?.hours_total > 0 || (moto.data as any)?.km_total > 0) && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
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

      {/* Perfil de uso — topo para contexto imediato */}
      <section className="surface-elevated rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Perfil de uso</h2>
        </div>
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
        {profile === "other" && (
          <Input
            value={profileNote}
            onChange={(e) => setProfileNote(e.target.value)}
            placeholder="ex: uso comercial em fazenda"
          />
        )}
      </section>

      {/* Contagem */}
      {loaded && (
        <p className="text-xs text-muted-foreground px-1">
          {activeCount} de {rows.length} itens selecionados — toque em uma categoria para revisar.
        </p>
      )}

      {/* Accordion por categoria */}
      {!loaded ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-14 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="surface-elevated rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Nenhum item disponível. Adicione manualmente ou volte à moto.
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ cat, label, items }) => {
            const open = openCats.has(cat);
            const activeInCat = items.filter(({ r }) => r.keep).length;
            return (
              <div key={cat} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Cabeçalho do accordion */}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`cat-${cat}`}
                  onClick={() => toggleCat(cat)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-muted/30 active:bg-muted/50"
                >
                  <span className="font-semibold text-sm">{label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {activeInCat}/{items.length}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {/* Conteúdo expandido */}
                {open && (
                  <div
                    id={`cat-${cat}`}
                    className="border-t border-border divide-y divide-border/60"
                  >
                    {items.map(({ r, i }) => (
                      <PlanItemRow
                        key={r.key}
                        row={r}
                        globalIndex={i}
                        intervalSummary={intervalSummary(r)}
                        onUpdate={(patch) => updateRow(i, patch)}
                        onRemove={() => removeRow(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Adicionar item personalizado */}
          <button
            type="button"
            onClick={addRow}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/60 py-3 text-sm text-muted-foreground hover:border-primary/40 transition"
          >
            <Plus className="h-4 w-4" /> Adicionar item personalizado
          </button>
        </div>
      )}

      {/* Botões de ação — fixos no rodapé */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Button
          className="w-full btn-glow text-base"
          size="lg"
          onClick={confirmPlan}
          disabled={saving || !loaded || activeCount === 0}
        >
          {saving
            ? "Salvando…"
            : `Confirmar plano — ${activeCount} item${activeCount !== 1 ? "s" : ""}`}
        </Button>
        <Button variant="ghost" className="w-full" asChild>
          <Link to="/motorcycles/$id" params={{ id }}>
            Pular por agora
          </Link>
        </Button>
      </div>
    </div>
  );
}
