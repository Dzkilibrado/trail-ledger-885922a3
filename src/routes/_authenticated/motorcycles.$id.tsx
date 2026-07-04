import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StoragePhoto } from "@/components/StoragePhoto";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { NewEventDialog } from "@/components/NewEventDialog";
import { ScheduleManager } from "@/components/ScheduleManager";
import { HealthPanel } from "@/components/HealthPanel";
import { ConservationCard } from "@/components/ConservationCard";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { Button } from "@/components/ui/button";
import { Trash2, QrCode, AlertTriangle, CheckCircle2, Clock, ArrowRightLeft, Copy, BadgeCheck, Archive, RotateCcw } from "lucide-react";
import { ClipboardCheck, Wand2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AuditSummary } from "@/components/AuditDialog";
import { toast } from "sonner";
import { priorityList } from "@/lib/maintenance-engine";
import { computeConservation, categoryHealth, docsHealth, historyHealth } from "@/lib/conservation";
import { useEffect } from "react";
import { usePlan } from "@/hooks/usePlan";
import { canCreateCertificate } from "@/lib/plans";
import { CertificateSettingsDialog } from "@/components/CertificateSettingsDialog";
import { TransferOwnershipDialog } from "@/components/TransferOwnershipDialog";
import { OwnershipTimeline } from "@/components/OwnershipTimeline";
import { MotorcycleDocuments } from "@/components/MotorcycleDocuments";
import { MotorcyclePhotos } from "@/components/MotorcyclePhotos";
import { InspectionDialog } from "@/components/InspectionDialog";
import { PlanCatalogSyncDialog } from "@/components/PlanCatalogSyncDialog";
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/motorcycles/$id")({
  head: () => ({ meta: [{ title: "Moto — TrailBook" }] }),
  component: MotoDetail,
});

function MotoDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { plan } = usePlan();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [inspectTarget, setInspectTarget] = useState<null | { id: string; name: string; category: string }>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("motorcycle_id", id).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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
      const { data } = await supabase.from("event_attachments").select("*").in("event_id", ids);
      return data ?? [];
    },
    enabled: !!events.data,
  });

  const ownership = useQuery({
    queryKey: ["ownership", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ownership_history")
        .select("id, owner_id, started_at, ended_at, method, profiles:owner_id(full_name)")
        .eq("motorcycle_id", id)
        .order("started_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id, started_at: r.started_at, ended_at: r.ended_at, method: r.method,
        owner_name: r.profiles?.full_name ?? null,
      }));
    },
  });

  const pendingTransfer = useQuery({
    queryKey: ["transfers-for-moto", id],
    queryFn: async () => {
      // Read from the masked view so recipients don't receive `to_email`.
      const { data } = await supabase
        .from("my_ownership_transfers" as never)
        .select("*")
        .eq("motorcycle_id", id)
        .eq("status", "pending")
        .maybeSingle();
      return data;
    },
  });

  const audit = useQuery({
    queryKey: ["audit", id],
    queryFn: async () => {
      const { data } = await supabase.from("audit_log").select("*").eq("motorcycle_id", id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  async function checkCertLimit(e: React.MouseEvent) {
    const { count } = await supabase.from("certificates").select("id", { count: "exact", head: true });
    if (!canCreateCertificate(plan, count ?? 0)) {
      e.preventDefault();
      e.stopPropagation();
      toast.error(`Plano ${plan.label} permite ${plan.limits.activeCertificates} certificado(s). Faça upgrade.`);
      navigate({ to: "/plans" });
    }
  }

  async function archiveMoto() {
    const { error } = await supabase.rpc("archive_motorcycle" as never, { _moto_id: id, _reason: archiveReason || null } as never);
    if (error) { toast.error(error.message || "Falha ao arquivar"); return; }
    toast.success("Moto arquivada. Histórico preservado para auditoria.");
    qc.invalidateQueries();
    navigate({ to: "/motorcycles" });
  }
  async function unarchiveMoto() {
    const { error } = await supabase.rpc("unarchive_motorcycle" as never, { _moto_id: id } as never);
    if (error) { toast.error(error.message || "Falha ao reativar"); return; }
    toast.success("Moto reativada na sua garagem.");
    qc.invalidateQueries();
  }

  const m = moto.data;
  const isOwner = !!m && !!currentUserId && (m as any).owner_id === currentUserId;
  const isArchived = (m as any)?.status === "archived";
  const totalCost = events.data?.reduce((s, e) => s + (Number(e.cost) || 0), 0) ?? 0;

  const statuses = (m && schedules.data && events.data)
    ? priorityList(schedules.data, m, events.data)
    : [];
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

  // Persiste o score recalculado quando muda (hook deve vir antes de qualquer return)
  useSyncConservation(m?.id ?? null, m?.conservation_score ?? 0, conservation.score);

  if (moto.isLoading) {
    return (
      <div className="space-y-4">
        <div className="surface-elevated h-56 animate-pulse rounded-2xl" />
        <div className="surface-elevated h-32 animate-pulse rounded-2xl" />
      </div>
    );
  }
  if (!m) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 font-display text-xl font-bold">Moto não encontrada</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ela pode ter sido removida ou pertence a outro usuário.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={m.nickname || m.model}
        crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: m.nickname || m.model }]}
      />
      <div className="surface-elevated overflow-hidden rounded-2xl">
        <div className="grid md:grid-cols-[280px_1fr]">
          <StoragePhoto path={m.main_photo_url} className="h-56 w-full md:h-full" />
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{m.brand} · {m.year_model || m.year_make || ""}</div>
                <h1 className="font-display text-3xl font-bold">{m.nickname || m.model}</h1>
                <div className="mt-1 text-sm text-muted-foreground">{m.model}{m.displacement ? ` · ${m.displacement}cc` : ""}{m.plate ? ` · ${m.plate}` : ""}</div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText((m as any).trailbook_id ?? ""); toast.success("TrailBook ID copiado"); }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-primary hover:bg-primary/10"
                  title="Identidade permanente da motocicleta"
                >
                  <Copy className="h-3 w-3" /> {(m as any).trailbook_id}
                </button>
              </div>
              <div className="rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary">{conservation.score}/100 · Nota {conservation.grade}</div>
            </div>
            {isArchived && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-semibold"><Archive className="h-4 w-4" /> Motocicleta arquivada</div>
                <p className="mt-1 text-amber-100/80">
                  Fora da garagem ativa. Histórico e auditoria preservados. Certificados públicos foram revogados.
                </p>
                {isOwner && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={unarchiveMoto}>
                    <RotateCcw className="h-4 w-4" /> Reativar moto
                  </Button>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Horas" value={`${Number(m.hours_total).toFixed(1)} h`} />
              <Stat label="Km" value={Number(m.km_total).toFixed(0)} />
              <Stat label="Investido" value={brl(totalCost)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {isOwner && <NewEventDialog moto={m} triggerLabel="Registrar atividade" />}
              <Button variant="outline" asChild className="btn-glow">
                <Link to="/motorcycles/$id/passport" params={{ id: m.id }}>
                  <BadgeCheck className="h-4 w-4" /> Passaporte Digital
                </Link>
              </Button>
              {isOwner && <ScheduleManager motoId={m.id} />}
              {isOwner && <Button variant="outline" asChild>
                <Link to="/motorcycles/$id/plan" params={{ id: m.id }}>
                  <Wand2 className="h-4 w-4" /> Plano sugerido
                </Link>
              </Button>}
              {isOwner && <PlanCatalogSyncDialog
                moto={m}
                trigger={
                  <Button variant="outline">
                    <Wand2 className="h-4 w-4" /> Atualizar plano com catálogo
                  </Button>
                }
              />}
              {isOwner && <CertificateSettingsDialog
                motorcycleId={m.id}
                trigger={<Button variant="outline" onClick={checkCertLimit}><QrCode className="h-4 w-4" /> Gerar certificado</Button>}
              />}
              {isOwner && (pendingTransfer.data ? (
                <Button variant="outline" disabled className="text-amber-400"><ArrowRightLeft className="h-4 w-4" /> Transferência pendente</Button>
              ) : (
                <TransferOwnershipDialog
                  motorcycleId={m.id}
                  trigger={<Button variant="outline"><ArrowRightLeft className="h-4 w-4" /> Transferir</Button>}
                />
              ))}
              {isOwner && !isArchived && <AlertDialog onOpenChange={(o) => !o && (setDeleteConfirm(""), setArchiveReason(""))}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive"><Archive className="h-4 w-4" /> Arquivar moto</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" /> Arquivar esta motocicleta?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <span className="block">
                        Você está prestes a arquivar <strong>{m.nickname || m.model}</strong>. Ela sairá da sua garagem ativa,
                        os <strong>certificados públicos serão revogados</strong> e o histórico permanecerá preservado para segurança e auditoria.
                      </span>
                      <span className="block">
                        O TrailBook ID <code className="font-mono">{(m as any).trailbook_id}</code> será descontinuado — não é reutilizado.
                        Se você está <strong>vendendo</strong> a moto, prefira <strong>Transferir Propriedade</strong>.
                      </span>
                      <span className="mt-2 block font-medium text-foreground">Digite <code className="font-mono">EXCLUIR</code> para confirmar:</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" autoFocus />
                  <Input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Motivo (opcional)" />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteConfirm !== "EXCLUIR"}
                      onClick={archiveMoto}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
                    >
                      Arquivar motocicleta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>}
              {!isOwner && currentUserId && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Modo somente leitura — você não é o proprietário desta moto
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Histórico de proprietários</h2>
        <OwnershipTimeline entries={ownership.data ?? []} />
      </section>

      <MotorcyclePhotos motorcycleId={m.id} />

      <MotorcycleDocuments motorcycleId={m.id} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Painel de saúde</h2>
        <HealthPanel items={health} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-bold">Próximas manutenções</h2>
          {statuses.length === 0 ? (
            <div className="surface-elevated rounded-2xl p-6 text-sm text-muted-foreground">
              Nenhuma programação ainda. Use <strong>Programações</strong> para aplicar o catálogo recomendado.
            </div>
          ) : (
            <ul className="space-y-2">
              {statuses.slice(0, 6).map((s) => {
                const Icon = s.status === "overdue" ? AlertTriangle : s.status === "due" ? AlertTriangle : s.status === "soon" ? Clock : CheckCircle2;
                const color = s.status === "overdue" ? "text-destructive" : s.status === "due" ? "text-amber-400" : s.status === "soon" ? "text-amber-300" : "text-emerald-400";
                return (
                  <li key={s.schedule.id} className="surface-elevated rounded-2xl p-3">
                    <div className="flex items-start gap-3">
                      <Icon className={`mt-0.5 h-4 w-4 ${color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="font-medium">{s.label}</div>
                          <div className={`text-xs ${color}`}>{s.status === "overdue" ? "Vencida" : s.status === "due" ? "Vence agora" : s.status === "soon" ? "Em breve" : "Em dia"}</div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {s.remaining.hours != null && <span>{s.remaining.hours.toFixed(1)} h restantes</span>}
                          {s.remaining.km != null && <span>{s.remaining.km.toFixed(0)} km restantes</span>}
                          {s.remaining.days != null && <span>{Math.round(s.remaining.days)} dias restantes</span>}
                          {s.estimatedDueDate && <span>· estimado {s.estimatedDueDate.toLocaleDateString("pt-BR")}</span>}
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${s.status === "overdue" || s.status === "due" ? "bg-destructive" : s.status === "soon" ? "bg-amber-400" : "bg-emerald-400"}`}
                            style={{ width: `${Math.min(100, s.progress * 100)}%` }}
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          {isOwner && <Button size="sm" variant="ghost" onClick={() => setInspectTarget({ id: s.schedule.id, name: s.label, category: s.schedule.category })}>
                            <ClipboardCheck className="h-3.5 w-3.5" /> Inspecionar
                          </Button>}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <ConservationCard result={conservation} />
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-bold">Linha do tempo</h2>
        {events.isLoading ? (
          <div className="text-muted-foreground">Carregando…</div>
        ) : events.data && events.data.length > 0 ? (
          <ol className="relative space-y-4 border-l border-border pl-6">
            {events.data.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[34px] top-2 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="surface-elevated rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <EventTypeIcon type={e.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-semibold">{e.title}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(e.occurred_at)}</div>
                      </div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">{EVENT_TYPE_LABEL[e.type]}</div>
                      {e.description && <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {e.hours_at_event != null && <span>{Number(e.hours_at_event).toFixed(1)} h</span>}
                        {e.km_at_event != null && <span>{Number(e.km_at_event).toFixed(0)} km</span>}
                        {e.location && <span>{e.location}</span>}
                        {e.cost != null && <span className="font-semibold text-primary">{brl(Number(e.cost))}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="surface-elevated rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Nenhum evento registrado ainda. Clique em <strong>Novo evento</strong> para começar.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <AuditSummary rows={(audit.data ?? []) as any} />
      </section>

      {inspectTarget && (
        <InspectionDialog
          open={!!inspectTarget}
          onOpenChange={(o) => !o && setInspectTarget(null)}
          motoId={m.id}
          schedule={inspectTarget}
          currentHours={Number(m.hours_total) || 0}
          currentKm={Number(m.km_total) || 0}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function useSyncConservation(motoId: string | null, current: number, computed: number) {
  useEffect(() => {
    if (!motoId) return;
    if (computed !== current) {
      supabase.from("motorcycles").update({ conservation_score: computed }).eq("id", motoId).then();
    }
  }, [motoId, current, computed]);
}