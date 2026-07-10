import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StoragePhoto } from "@/components/StoragePhoto";
import { HealthPanel } from "@/components/HealthPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { CertificateSettingsDialog } from "@/components/CertificateSettingsDialog";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { computeConservation, categoryHealth, docsHealth, historyHealth } from "@/lib/conservation";
import { priorityList } from "@/lib/maintenance-engine";
import {
  buildTimeline,
  derivePending,
  computeCertifiedTier,
  CERTIFIED_TIER_LABEL,
  type PassportEntry,
  type PassportEntryKind,
} from "@/lib/passport";
import { AlertTriangle, ArrowLeft, BadgeCheck, Copy, FileText, QrCode, Share2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ReceiptsSummaryRow } from "@/components/receipts/ReceiptsHistorySheet";
import { useReceiptsForMoto } from "@/hooks/useActiveNegotiation";
import { useEffect, useState as _unused } from "react";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/passport")({
  head: () => ({ meta: [{ title: "Passaporte Digital — TrailBook" }] }),
  component: Passport,
});

const KIND_LABEL: Record<PassportEntryKind, string> = {
  creation: "Cadastro",
  purchase: "Compra",
  sale: "Venda",
  ownership_transfer: "Troca de proprietário",
  maintenance: "Manutenção",
  revision: "Revisão",
  usage: "Uso",
  incident: "Sinistro",
  recall: "Recall",
  warranty: "Garantia",
  accessory: "Acessório",
  note: "Observação",
  document: "Documento",
  photo: "Foto",
  certificate: "Certificado emitido",
};

const TIER_STYLE: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  bronze: "bg-amber-900/30 text-amber-300 border border-amber-600/40",
  silver: "bg-slate-500/20 text-slate-200 border border-slate-400/40",
  gold: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50",
  platinum: "bg-cyan-400/20 text-cyan-100 border border-cyan-300/60",
  diamond: "bg-gradient-to-r from-fuchsia-500/30 to-cyan-400/30 text-white border border-fuchsia-300/60",
};

function Passport() {
  const { id } = Route.useParams();
  const [filter, setFilter] = useState<string>("all");

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("id", id).single()).data,
  });
  const events = useQuery({
    queryKey: ["events", id],
    queryFn: async () => (await supabase.from("events").select("*").eq("motorcycle_id", id).order("occurred_at", { ascending: false })).data ?? [],
  });
  const documents = useQuery({
    queryKey: ["motorcycle_documents", id],
    queryFn: async () => (await supabase.from("motorcycle_documents").select("*").eq("motorcycle_id", id)).data ?? [],
  });
  const photos = useQuery({
    queryKey: ["motorcycle_photos", id],
    queryFn: async () => (await supabase.from("motorcycle_photos").select("*").eq("motorcycle_id", id).order("position")).data ?? [],
  });
  const ownership = useQuery({
    queryKey: ["ownership", id],
    queryFn: async () => (await supabase.from("ownership_history").select("*").eq("motorcycle_id", id).order("started_at")).data ?? [],
  });
  const certificates = useQuery({
    queryKey: ["certificates", id],
    queryFn: async () => (await supabase.from("certificates").select("*").eq("motorcycle_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const schedules = useQuery({
    queryKey: ["schedules", id],
    queryFn: async () => (await supabase.from("maintenance_schedules").select("*").eq("motorcycle_id", id)).data ?? [],
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
    queryFn: async () => (await supabase.from("workshops").select("id, name")).data ?? [],
  });
  const receipts = useReceiptsForMoto(id);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const workshopsById = useMemo(() => {
    const m: Record<string, { name: string }> = {};
    (workshops.data ?? []).forEach((w) => { m[w.id] = { name: w.name }; });
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

  const filteredTimeline = filter === "all" ? timeline : timeline.filter((t) => t.kind === filter);

  const m = moto.data;
  const statuses = m && schedules.data && events.data ? priorityList(schedules.data, m, events.data) : [];
  const workshopEventIds = new Set((events.data ?? []).filter((e) => e.workshop_id).map((e) => e.id));
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
  const hasInvoice = (documents.data ?? []).some((d) => d.doc_type === "invoice" && !d.deleted_at);
  const overdueSchedules = statuses.filter((s) => s.status === "overdue").length;
  const pending = m ? derivePending({
    motorcycle: m,
    documents: documents.data ?? [],
    photos: photos.data ?? [],
    overdueSchedules,
    hasInvoice,
  }) : [];
  const criticalPending = pending.filter((p) => p.severity === "critical").length;
  const { tier, reasons } = computeCertifiedTier({ conservation, categories: health, hasInvoice, criticalPending });

  if (moto.isLoading) {
    return <div className="surface-elevated h-64 animate-pulse rounded-2xl" />;
  }
  if (!m) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 font-display text-xl font-bold">Moto não encontrada</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passaporte Digital"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: m.nickname || m.model, to: `/motorcycles/${m.id}` },
          { label: "Passaporte" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/motorcycles/$id" params={{ id: m.id }}>
                <ArrowLeft className="h-4 w-4" /> Voltar à moto
              </Link>
            </Button>
            <CertificateSettingsDialog
              motorcycleId={m.id}
              trigger={<Button className="btn-glow"><Share2 className="h-4 w-4" /> Compartilhar / Certificado</Button>}
            />
          </div>
        }
      />

      {/* Hero */}
      <div className="surface-elevated overflow-hidden rounded-2xl">
        <div className="grid md:grid-cols-[280px_1fr]">
          <StoragePhoto path={m.main_photo_url} className="h-56 w-full md:h-full" />
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {m.brand} · {m.year_model || m.year_make || ""}
                </div>
                <h1 className="font-display text-3xl font-bold">{m.nickname || m.model}</h1>
                <div className="mt-1 text-sm text-muted-foreground">
                  {m.model}{m.displacement ? ` · ${m.displacement}cc` : ""}{m.plate ? ` · ${m.plate}` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText((m as any).trailbook_id ?? ""); toast.success("TrailBook ID copiado"); }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-primary hover:bg-primary/10"
                >
                  <Copy className="h-3 w-3" /> {(m as any).trailbook_id}
                </button>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary">
                  Saúde {conservation.score}/100 · Nota {conservation.grade}
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${TIER_STYLE[tier]}`}>
                  <BadgeCheck className="mr-1 inline h-3.5 w-3.5" />
                  {CERTIFIED_TIER_LABEL[tier]}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <MetricBox label="Km total" value={Number(m.km_total ?? 0).toFixed(0)} />
              <MetricBox label="Horímetro" value={`${Number(m.hours_total ?? 0).toFixed(1)} h`} />
              <MetricBox label="Eventos" value={String((events.data ?? []).length)} />
              <MetricBox label="Documentos" value={String((documents.data ?? []).filter((d) => !d.deleted_at).length)} />
            </div>
            <p className="text-xs text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
              Documento vivo — cada evento registrado no TrailBook atualiza este passaporte automaticamente (Single Source of Truth).
            </p>
          </div>
        </div>
      </div>

      {/* Pendências e Selo */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold">
            <ShieldAlert className="h-4 w-4 text-amber-400" /> Pendências
          </h2>
          {pending.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma pendência. Excelente cuidado!</div>
          ) : (
            <ul className="space-y-2">
              {pending.map((p) => (
                <li key={p.key} className="flex items-start gap-3 rounded-xl border border-border/60 p-3 text-sm">
                  <Badge
                    variant="outline"
                    className={
                      p.severity === "critical" ? "border-destructive/50 text-destructive" :
                      p.severity === "warn" ? "border-amber-500/50 text-amber-400" :
                      "border-muted-foreground/40 text-muted-foreground"
                    }
                  >
                    {p.severity === "critical" ? "Crítico" : p.severity === "warn" ? "Atenção" : "Info"}
                  </Badge>
                  <div className="flex-1">
                    <div className="font-medium">{p.label}</div>
                    {p.hint && <div className="text-xs text-muted-foreground">{p.hint}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold">
            <BadgeCheck className="h-4 w-4 text-primary" /> Selo TrailBook Certified
          </h2>
          <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${TIER_STYLE[tier]}`}>
            {CERTIFIED_TIER_LABEL[tier]}
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>• Cálculo automático — nunca informado manualmente.</li>
            {reasons.map((r, i) => <li key={i}>• {r}</li>)}
            <li>• Fase 2 (planejada): incorporar TrailBook Score e histórico de sinistros/recalls.</li>
          </ul>
        </div>
      </div>

      {/* Painel de saúde por categoria */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Painel de saúde</h2>
        <HealthPanel items={health} />
      </section>

      {/* Timeline consolidada */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Linha do tempo</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filteredTimeline.length} de {timeline.length}</span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {Object.entries(KIND_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="surface-elevated overflow-hidden rounded-2xl">
          {filteredTimeline.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sem registros neste filtro.</div>
          ) : (
            <ol className="divide-y divide-border/50">
              {filteredTimeline.map((t) => (
                <li key={t.id} className="flex items-start gap-3 p-4 hover:bg-muted/20">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    {t.source === "events" ? (
                      <EventTypeIcon type={t.kind as any} className="h-4 w-4" />
                    ) : t.source === "motorcycle_documents" ? (
                      <FileText className="h-4 w-4" />
                    ) : t.source === "certificates" ? (
                      <QrCode className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <span className="mr-2 text-xs uppercase tracking-widest text-muted-foreground">
                          {KIND_LABEL[t.kind] ?? EVENT_TYPE_LABEL[t.kind as never] ?? t.kind}
                        </span>
                        <span className="font-medium">{t.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(t.occurredAt)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {t.workshopName && <span>🔧 {t.workshopName}</span>}
                      {t.odometerKm != null && <span>{t.odometerKm.toLocaleString("pt-BR")} km</span>}
                      {t.cost != null && t.cost > 0 && <span className="text-primary">{brl(t.cost)}</span>}
                    </div>
                    {t.description && (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <div className="surface-elevated rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Compartilhamento ativo:</strong> use o botão acima para gerar um link público
        com audiência definida (comprador, oficina, seguradora, despachante, familiar), QR Code pronto para impressão,
        data de expiração opcional e revogação a qualquer momento. Cada abertura fica registrada no log de acessos do
        certificado. Próximos passos previstos: TrailBook Score próprio, módulo de valorização e resumos por IA.
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
