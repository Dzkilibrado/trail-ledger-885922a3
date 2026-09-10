import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StoragePhoto } from "@/components/StoragePhoto";
import { HealthPanel } from "@/components/HealthPanel";
import { Button } from "@/components/ui/button";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { computeConservation, categoryHealth, docsHealth, historyHealth } from "@/lib/conservation";
import { priorityList } from "@/lib/maintenance-engine";
import {
  buildTimeline,
  derivePending,
  computeCertifiedTier,
  type PassportEntry,
  type PassportEntryKind,
} from "@/lib/passport";
import {
  AlertTriangle,
  BadgeCheck,
  Copy,
  FileText,
  FolderOpen,
  QrCode,
  Share2,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Clock,
  Wrench,
  FileCheck2,
  Info,
} from "lucide-react";
import { PresentDocumentsSheet } from "@/components/documents/PresentDocumentsSheet";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP } from "@/lib/help/texts";
import { SCORE_TIER_STYLE as TIER_STYLE } from "@/lib/ui/status-styles";
import {
  buildEvaluation,
  stateFromRideAnswer,
  EVALUATION_LABEL,
  RIDE_VERDICT,
  EVALUATION_DOT,
} from "@/lib/ui/evaluation";
import { computeActionPlan, computeRideAnswer, computeComponentViews } from "@/lib/til";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/passport")({
  head: () => ({ meta: [{ title: "Passaporte Digital — TrailBook" }] }),
  component: Passport,
});


function Passport() {
  const { id } = Route.useParams();
  const [presentOpen, setPresentOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () =>
      (await supabase.from("motorcycles").select("*").eq("id", id).single()).data,
  });
  const events = useQuery({
    queryKey: ["events", id],
    queryFn: async () =>
      (
        await supabase
          .from("events")
          .select("*")
          .eq("motorcycle_id", id)
          .order("occurred_at", { ascending: false })
      ).data ?? [],
  });
  const documents = useQuery({
    queryKey: ["motorcycle_documents", id],
    queryFn: async () =>
      (await supabase.from("motorcycle_documents").select("*").eq("motorcycle_id", id)).data ?? [],
  });
  const photos = useQuery({
    queryKey: ["motorcycle_photos", id],
    queryFn: async () =>
      (
        await supabase
          .from("motorcycle_photos")
          .select("*")
          .eq("motorcycle_id", id)
          .order("position")
      ).data ?? [],
  });
  const ownership = useQuery({
    queryKey: ["ownership", id],
    queryFn: async () =>
      (
        await supabase
          .from("ownership_history")
          .select("*")
          .eq("motorcycle_id", id)
          .order("started_at")
      ).data ?? [],
  });
  const certificates = useQuery({
    queryKey: ["certificates", id],
    queryFn: async () =>
      (
        await supabase
          .from("certificates")
          .select("*")
          .eq("motorcycle_id", id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const schedules = useQuery({
    queryKey: ["schedules", id],
    queryFn: async () =>
      (await supabase.from("maintenance_schedules").select("*").eq("motorcycle_id", id)).data ?? [],
  });
  const attachments = useQuery({
    queryKey: ["attachments", id],
    queryFn: async () => {
      const ids = (events.data ?? []).map((e) => e.id);
      if (ids.length === 0) return [];
      return (await supabase.from("event_attachments").select("*").in("event_id", ids)).data ?? [];
    },
    enabled: !!events.data,
  });
  const workshops = useQuery({
    queryKey: ["workshops", "byId"],
    queryFn: async () => (await supabase.from("workshops_public").select("id, name")).data ?? [],
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user.id ?? null));
  }, []);

  const workshopsById = useMemo(() => {
    const m: Record<string, { name: string }> = {};
    (workshops.data ?? []).forEach((w) => {
      if (w.id && w.name) m[w.id] = { name: w.name };
    });
    return m;
  }, [workshops.data]);

  const timeline: PassportEntry[] = useMemo(() => {
    if (!moto.data) return [];
    return buildTimeline({
      motorcycle: moto.data,
      events: events.data ?? [],
      documents: documents.data ?? [],
      ownership: ownership.data ?? [],
      certificates: certificates.data ?? [],
      workshopsById,
    });
  }, [moto.data, events.data, documents.data, ownership.data, certificates.data, workshopsById]);


  const m = moto.data;
  const statuses =
    m && schedules.data && events.data ? priorityList(schedules.data, m, events.data) : [];
  const workshopEventIds = new Set(
    (events.data ?? []).filter((e) => e.workshop_id).map((e) => e.id),
  );
  const conservation = computeConservation({
    events: events.data ?? [],
    attachments: attachments.data ?? [],
    statuses,
    workshopEventIds,
    hasDocs: { plate: !!m?.plate, renavam: !!m?.renavam, chassis: !!m?.chassis },
  });
  const health = [
    ...categoryHealth(statuses),
    docsHealth({ plate: !!m?.plate, renavam: !!m?.renavam, chassis: !!m?.chassis }),
    historyHealth(events.data ?? []),
  ];
  const hasInvoice = (documents.data ?? []).some(
    (d) => d.doc_type === "invoice" && !d.deleted_at && d.is_current,
  );
  const overdueSchedules = statuses.filter((s) => s.status === "overdue").length;
  const pending = m
    ? derivePending({
        motorcycle: m,
        documents: documents.data ?? [],
        photos: photos.data ?? [],
        overdueSchedules,
        hasInvoice,
      })
    : [];
  const criticalPending = pending.filter((p) => p.severity === "critical").length;
  const { tier, reasons } = computeCertifiedTier({
    conservation,
    categories: health,
    hasInvoice,
    criticalPending,
  });

  // Cálculo de rideAnswer e actionPlan para Diagnóstico resumido
  // statuses já calculado acima via priorityList — reutiliza sem recalcular
  const components = computeComponentViews(
    schedules.data ?? [],
    statuses,
    events.data ?? [],
    {},
    {},
    {
      usage: {
        hours: m ? Number((m as any).hours_total ?? 0) : null,
        km: m ? Number((m as any).km_total ?? 0) : null,
      },
    },
  );
  const actionPlan = computeActionPlan(components);
  const rideAnswer = computeRideAnswer({ components, actionPlan });
  const evalState = stateFromRideAnswer(rideAnswer);
  const evalView = buildEvaluation(rideAnswer);

  // Top-3 cuidados mais relevantes
  const top3 = actionPlan.slice(0, 3);


  // Labels para o selo em português
  const TIER_LABEL_PT: Record<string, string> = {
    none: "Sem selo",
    bronze: "Bronze",
    silver: "Prata",
    gold: "Ouro",
    platinum: "Platina",
    diamond: "Diamante",
  };

  if (moto.isLoading) {
    return (
      <div className="space-y-4 px-1">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (!m) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 font-display text-xl font-bold">Moto não encontrada</h2>
      </div>
    );
  }

  const activeDocs = (documents.data ?? []).filter((d) => !d.deleted_at && d.is_current);
  const hasNF = activeDocs.some((d) => d.doc_type === "invoice");
  const hasRecibo = activeDocs.some((d) => d.doc_type === "bill_of_sale");
  const otherDocs = activeDocs.filter((d) => d.doc_type !== "invoice" && d.doc_type !== "bill_of_sale");

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 pb-10">
      {/* CABEÇALHO */}
      <PageHeader
        title="Passaporte Digital"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: m.nickname || m.model, to: `/motorcycles/${m.id}` },
          { label: "Passaporte" },
        ]}
      />

      <PresentDocumentsSheet
        open={presentOpen}
        onOpenChange={setPresentOpen}
        motorcycleId={m.id}
        motorcycleLabel={m.nickname || m.model}
      />

      {/* ── 1. IDENTIFICAÇÃO ─────────────────────────────── */}
      <div className="surface-elevated overflow-hidden rounded-2xl">
        <div className="flex gap-3 p-4">
          {m.main_photo_url && (
            <StoragePhoto
              path={m.main_photo_url}
              className="h-20 w-20 shrink-0 rounded-xl object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {m.brand} · {m.year_model || m.year_make || "—"}
            </p>
            <h1 className="font-display text-xl font-bold leading-tight">
              {m.nickname || m.model}
            </h1>
            {m.nickname && <p className="text-sm text-muted-foreground">{m.model}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {Number(m.hours_total ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {Number(m.hours_total).toFixed(1)} h
                </span>
              )}
              {Number(m.km_total ?? 0) > 0 && (
                <span>{Number(m.km_total).toLocaleString("pt-BR")} km</span>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText((m as any).trailbook_id ?? "");
                  toast.success("TrailBook ID copiado");
                }}
                className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-bold text-primary hover:bg-primary/10"
              >
                <Copy className="h-2.5 w-2.5" /> {(m as any).trailbook_id}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. SELO DE CONSERVAÇÃO ───────────────────────── */}
      {/* Sempre exibido — tier=none informa o que falta para atingir Bronze */}
      <div className="surface-elevated rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Selo de Conservação TrailBook
            </p>
            {tier === "none" ? (
              <p className="mt-1 text-sm text-muted-foreground">Ainda não disponível</p>
            ) : (
              <div className={`mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-semibold ${TIER_STYLE[tier]}`}>
                <BadgeCheck className="h-4 w-4" />
                {TIER_LABEL_PT[tier] ?? tier}
              </div>
            )}
          </div>
          <HelpTooltip
            label="Sobre este selo"
            text="Calculado automaticamente com base no histórico, manutenção e evidências registradas no TrailBook. Não representa inspeção física ou certificação externa."
            side="left"
          />
        </div>

        {/* Reasons: o que falta ou o que impede um nível mais alto */}
        {reasons.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <Info className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 3. DIAGNÓSTICO RESUMIDO ──────────────────────── */}
      <div className="surface-elevated rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setDiagOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/20 transition"
          aria-expanded={diagOpen}
        >
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 shrink-0 rounded-full ${EVALUATION_DOT[evalState]}`} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Diagnóstico</p>
              <p className="font-semibold text-sm">{EVALUATION_LABEL[evalState]}</p>
              <p className="text-xs text-muted-foreground">{RIDE_VERDICT[evalState]}</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${diagOpen ? "rotate-180" : ""}`} />
        </button>
        {diagOpen && (
          <div className="border-t border-border/60 px-4 py-3 space-y-3 text-sm">
            {/* Achados */}
            <div className="space-y-1">
              {evalView.findings.map((f, i) => (
                <p key={i} className="text-muted-foreground text-xs">{f}</p>
              ))}
            </div>
            {/* Recomendação */}
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
              {evalView.recommendation}
            </p>
            {/* Pendências — máx 3 inicialmente, "Ver todas" se houver mais */}
            {pending.length > 0 && (
              <div className="pt-1 border-t border-border/40 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3 text-amber-400" /> Pendências
                </p>
                {(showAllPending ? pending : pending.slice(0, 3)).map((p) => (
                  <div key={p.key} className="flex items-start gap-2 text-xs">
                    <span className={
                      p.severity === "critical" ? "font-bold text-destructive"
                      : p.severity === "warn" ? "text-amber-400"
                      : "text-muted-foreground"
                    }>
                      {p.severity === "critical" ? "⚠" : "•"}
                    </span>
                    <div>
                      <span className="text-foreground">{p.label}</span>
                      {p.hint && <span className="ml-1 text-muted-foreground">— {p.hint}</span>}
                    </div>
                  </div>
                ))}
                {pending.length > 3 && (
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setShowAllPending((v) => !v)}
                  >
                    {showAllPending ? "Ver menos" : `Ver todas (${pending.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. PRÓXIMOS CUIDADOS (top 3) ─────────────────── */}
      {top3.length > 0 && (
        <div className="surface-elevated rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Próximos cuidados
          </p>
          {top3.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2">
              <Wrench className="h-4 w-4 shrink-0 text-primary/70" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {item.dueEstimateLabel && (
                  <p className="text-xs text-muted-foreground">{item.dueEstimateLabel}</p>
                )}
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="w-full mt-1" asChild>
            <Link to="/motorcycles/$id/plan" params={{ id: m.id }}>
              <ChevronRight className="h-4 w-4" /> Ver plano de manutenção
            </Link>
          </Button>
        </div>
      )}

      {/* ── 5. DOCUMENTAÇÃO RESUMIDA ─────────────────────── */}
      <div className="surface-elevated rounded-2xl p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Documentação
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <FileCheck2 className={`h-4 w-4 shrink-0 ${hasNF ? "text-emerald-500" : "text-muted-foreground/40"}`} />
            <span className={hasNF ? "text-foreground" : "text-muted-foreground"}>
              Nota Fiscal {!hasNF && <span className="text-xs">(não anexada)</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileCheck2 className={`h-4 w-4 shrink-0 ${hasRecibo ? "text-emerald-500" : "text-muted-foreground/40"}`} />
            <span className={hasRecibo ? "text-foreground" : "text-muted-foreground"}>
              Recibo de Compra e Venda {!hasRecibo && <span className="text-xs">(não anexado)</span>}
            </span>
          </div>
          {otherDocs.length > 0 && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <span className="text-muted-foreground text-xs">+ {otherDocs.length} outro{otherDocs.length > 1 ? "s" : ""} documento{otherDocs.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setPresentOpen(true)}>
          <FolderOpen className="h-4 w-4" /> Apresentar documentos
        </Button>
      </div>

      {/* ── 6. SAÚDE (colapsada) ─────────────────────────── */}
      <div className="surface-elevated rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setHealthOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/20 transition"
          aria-expanded={healthOpen}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Painel de saúde
          </p>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${healthOpen ? "rotate-180" : ""}`} />
        </button>
        {healthOpen && (
          <div className="border-t border-border/60 px-4 pb-4 pt-3">
            <HealthPanel items={health} />
          </div>
        )}
      </div>

      {/* ── 7. HISTÓRICO (3 recentes + expandir inline) ──── */}
      {(() => {
        const visibleTimeline = showAll ? timeline : timeline.slice(0, 3);
        return (
          <div className="surface-elevated rounded-2xl overflow-hidden">
            <p className="px-4 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Histórico
            </p>
            {timeline.length === 0 ? (
              <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              <>
                <ol className="divide-y divide-border/50 mt-2">
                  {visibleTimeline.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        {t.source === "events" ? (
                          <EventTypeIcon type={t.kind as any} className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.occurredAt)}
                          {t.odometerKm != null && ` · ${t.odometerKm.toLocaleString("pt-BR")} km`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {timeline.length > 3 && (
                  <div className="px-4 pb-3 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAll((v) => !v)}
                    >
                      <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showAll ? "rotate-180" : ""}`} />
                      {showAll
                        ? "Ver menos"
                        : `Ver todos os ${timeline.length} eventos`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── 8. AÇÕES PRINCIPAIS ──────────────────────────── */}
      <div className="flex flex-col gap-2">
        <Button className="w-full btn-glow" asChild>
          <Link to="/motorcycles/$id/certificate" params={{ id: m.id }}>
            <Share2 className="h-4 w-4" /> Certificado Digital
          </Link>
        </Button>
        <Button variant="outline" className="w-full" onClick={() => setPresentOpen(true)}>
          <FolderOpen className="h-4 w-4" /> Apresentar documentos
        </Button>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}
