import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { StoragePhoto } from "@/components/StoragePhoto";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { NewEventDialog } from "@/components/NewEventDialog";
import { ComponentsList } from "@/components/components/ComponentsList";
import { InitialReviewSheet } from "@/components/onboarding/InitialReviewSheet";
import { HealthOverview } from "@/components/health/HealthOverview";
import { ConservationCard } from "@/components/ConservationCard";
import { EvaluationPill } from "@/components/health/EvaluationPill";
import { stateFromScore } from "@/lib/ui/evaluation";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Copy,
  BadgeCheck,
  Archive,
  RotateCcw,
  ChevronDown,
  Stethoscope,
  ChevronRight,
  LayoutDashboard,
  Settings2,
  ClipboardList,
  FileText,
  ArrowLeft,
} from "lucide-react";
// Tabs removidos — substituídos por grid de cards de navegação
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { LastReportCard } from "@/components/health/reports/LastReportCard";
import { ClipboardCheck, Wand2, Pencil, MoreVertical, Wrench, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { priorityList } from "@/lib/maintenance-engine";
import { computeConservation, categoryHealth, docsHealth, historyHealth } from "@/lib/conservation";
import { useEffect } from "react";
// Certificado Digital agora vive em rota dedicada por moto (/motorcycles/$id/certificate)
import { TransferOwnershipDialog } from "@/components/TransferOwnershipDialog";
import { MotorcycleDocuments } from "@/components/MotorcycleDocuments";
import { MotorcyclePhotos } from "@/components/MotorcyclePhotos";
import { InspectionDialog } from "@/components/InspectionDialog";
import { PlanCatalogSyncDialog } from "@/components/PlanCatalogSyncDialog";
import { Link } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AdminMotoDangerZone } from "@/components/AdminMotoDangerZone";
import { EventActionsMenu } from "@/components/EventActionsMenu";
import { useMotoDocumentPendency } from "@/hooks/useDocumentPendencies";
import { OriginPendencyBanner } from "@/components/OriginPendencyBanner";
import { BadgeSection } from "@/components/badges/BadgeSection";
import { useActiveNegotiation } from "@/hooks/useActiveNegotiation";
import { ActiveNegotiationCard } from "@/components/ActiveNegotiationCard";
import { EmitReceiptDialog } from "@/components/receipts/EmitReceiptDialog";
import { FileSignature, Eye } from "lucide-react";
import { ReceiptsSummaryRow } from "@/components/receipts/ReceiptsHistorySheet";
import { useReceiptsForMoto } from "@/hooks/useActiveNegotiation";
import {
  clearActiveMotorcycleIfMatches,
  invalidateMotorcycleState,
  setStoredActiveMotorcycleId,
} from "@/hooks/useActiveMotorcycle";

/** Seções navegáveis da Central da Moto */
type ControlView = "menu" | "geral" | "checkup" | "componentes" | "atividade" | "documentos";

function resolveInitialView(
  tab?: "geral" | "checkup" | "componentes" | "atividade" | "documentos" | "historico",
): ControlView {
  if (!tab) return "menu";
  if (tab === "historico") return "atividade"; // alias legado
  return tab;
}

export function MotoControlCenter({
  id,
  autoOpenAction,
  initialTab,
}: {
  id: string;
  autoOpenAction?: "registrar";
  /** Abre direto numa seção específica — usado pelos atalhos da tela inicial. */
  initialTab?: "geral" | "checkup" | "componentes" | "atividade" | "documentos" | "historico";
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [archiveReason, setArchiveReason] = useState<string>("");
  const [archiveReasonOther, setArchiveReasonOther] = useState<string>("");
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [view, setView] = useState<ControlView>(() => resolveInitialView(initialTab));
  // Sub-navegação dentro de Lançamentos
  type LancamentoFilter = "menu" | "maintenance" | "usage" | "incident" | "accessory" | "note";
  const [lancamentoFilter, setLancamentoFilter] = useState<LancamentoFilter>("menu");
  const [activitySearch, setActivitySearch] = useState("");
  // activityTypeFilter removido — sub-menu de cards substitui os filtros pill
  const [inspectTarget, setInspectTarget] = useState<null | {
    id: string;
    name: string;
    category: string;
  }>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Atalho "Registrar atividade" da tela inicial: abre o formulário direto,
  // sem exigir um segundo clique aqui na Central da moto.
  const [autoOpenEvent, setAutoOpenEvent] = useState<boolean | undefined>(
    autoOpenAction === "registrar" ? true : undefined,
  );
  useEffect(() => {
    if (autoOpenAction === "registrar") {
      // Limpa o parâmetro da URL para não reabrir ao voltar/atualizar a página.
      navigate({ to: ".", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user.id ?? null));
  }, []);

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    // Manter dado anterior durante refetch para evitar falso "Moto não encontrada"
    placeholderData: (prev: any) => prev,
    staleTime: 30_000, // 30s — evita refetch na troca de rota
  });

  const pendency = useMotoDocumentPendency(id);
  const activeNegotiation = useActiveNegotiation(id);
  const receiptsForMoto = useReceiptsForMoto(id);
  function openReceiptPdf(code: string, variant: "signed" | "original") {
    navigate({
      to: "/recibos/$code/visualizar",
      params: { code },
      search: { variant, from: `/motorcycles/${id}/control` },
    });
  }

  const events = useQuery({
    queryKey: ["events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("motorcycle_id", id)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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
      const { data } = await supabase.from("event_attachments").select("*").in("event_id", ids);
      return data ?? [];
    },
    enabled: !!events.data,
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

  async function archiveMoto() {
    const finalReason =
      archiveReason === "Outros motivos"
        ? `Outros motivos: ${archiveReasonOther.trim()}`
        : archiveReason;
    const { error } = await supabase.rpc(
      "archive_motorcycle" as never,
      { _moto_id: id, _reason: finalReason || null } as never,
    );
    if (error) {
      toast.error(error.message || "Falha ao arquivar");
      return;
    }
    clearActiveMotorcycleIfMatches(id);
    await invalidateMotorcycleState(qc);
    toast.success("Moto arquivada. Histórico preservado para auditoria.");
    navigate({ to: "/motorcycles" });
  }
  async function deleteMoto() {
    if (!m) return;
    const { error } = await (supabase as any).rpc("delete_motorcycle_permanently", { _moto_id: m.id });
    if (error) {
      toast.error("Não foi possível excluir a moto", { description: error.message });
      return;
    }
    setDeleteOpen(false);
    setDeleteWord("");
    await qc.invalidateQueries();
    toast.success(`${m.nickname || m.model} foi excluída permanentemente.`);
    navigate({ to: "/motorcycles" });
  }

  async function unarchiveMoto() {
    const { error } = await supabase.rpc(
      "unarchive_motorcycle" as never,
      { _moto_id: id } as never,
    );
    if (error) {
      toast.error(error.message || "Falha ao reativar");
      return;
    }
    setStoredActiveMotorcycleId(id);
    await invalidateMotorcycleState(qc);
    toast.success("Moto reativada na sua garagem.");
    setUnarchiveOpen(false);
  }

  const m = moto.data;
  const isOwner = !!m && !!currentUserId && (m as any).owner_id === currentUserId;
  const isArchived = (m as any)?.status === "archived";
  const totalCost = events.data?.reduce((s, e) => s + (Number(e.cost) || 0), 0) ?? 0;

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

  // Persiste o score recalculado quando muda (hook deve vir antes de qualquer return)
  useSyncConservation(m?.id ?? null, m?.conservation_score ?? 0, conservation.score);

  // Loading: query em andamento ou sem dado ainda (mas não em erro)
  if (moto.isLoading || (!moto.data && !moto.isError)) {
    return (
      <div className="space-y-4">
        <div className="surface-elevated h-56 animate-pulse rounded-2xl" />
        <div className="surface-elevated h-32 animate-pulse rounded-2xl" />
      </div>
    );
  }

  // Erro de rede: diferente de "não encontrada"
  if (moto.isError && moto.data === undefined) {
    const isNotFound = (moto.error as any)?.code === "PGRST116" ||
      (moto.error as any)?.message?.includes("0 rows");
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        {isNotFound ? (
          <>
            <h2 className="mt-4 font-display text-xl font-bold">Moto não encontrada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ela pode ter sido removida ou pertence a outro usuário.
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-4 font-display text-xl font-bold">Erro ao carregar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Verifique sua conexão e tente novamente.
            </p>
            <button
              onClick={() => moto.refetch()}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    );
  }

  // Sem dado e sem erro explícito (estado improvável com placeholderData)
  if (!m) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 font-display text-xl font-bold">Moto não encontrada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ela pode ter sido removida ou pertence a outro usuário.
        </p>
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
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {m.brand} · {m.year_model || m.year_make || ""}
                </div>
                <h1 className="font-display text-3xl font-bold">{m.nickname || m.model}</h1>
                <div className="mt-1 text-sm text-muted-foreground">
                  {m.model}
                  {m.displacement ? ` · ${m.displacement}cc` : ""}
                  {m.plate ? ` · ${m.plate}` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText((m as any).trailbook_id ?? "");
                    toast.success("TrailBook ID copiado");
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-primary hover:bg-primary/10"
                  title="Identidade permanente da motocicleta"
                >
                  <Copy className="h-3 w-3" /> {(m as any).trailbook_id}
                </button>
              </div>
              <EvaluationPill state={stateFromScore(conservation.score)} />
            </div>
            {isArchived && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-semibold">
                  <Archive className="h-4 w-4" /> Motocicleta arquivada
                </div>
                <p className="mt-1 text-amber-100/80">
                  Fora da garagem ativa. Histórico e auditoria preservados. Certificados públicos
                  foram revogados.
                </p>
                {isOwner && (
                  <AlertDialog open={unarchiveOpen} onOpenChange={setUnarchiveOpen}>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="mt-2">
                        <RotateCcw className="h-4 w-4" /> Restaurar moto
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <RotateCcw className="h-5 w-5" /> Restaurar esta motocicleta?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          <strong>{m.nickname || m.model}</strong> voltará para a sua garagem ativa.
                          Todo o histórico, documentos, atividades e certificados permanecem
                          inalterados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={unarchiveMoto}>
                          Restaurar moto
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
            {isOwner &&
              (m as any).condition === "used" &&
              !(m as any).initial_review_done_at &&
              !isArchived && (
                <div className="rounded-xl border border-border/60 bg-card/60 p-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">
                        Revisão inicial — opcional
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        Para motos usadas, é recomendável registrar o estado inicial de cada
                        componente. Isso melhora a precisão dos alertas de manutenção.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
                      <Wand2 className="h-4 w-4" /> Iniciar revisão
                    </Button>
                  </div>
                </div>
              )}
            {isOwner && !isArchived && pendency.data?.has_origin_pendency && (
              <OriginPendencyBanner motoId={m.id} userId={currentUserId} pendency={pendency.data} />
            )}
            {/* Selos de qualidade removidos por decisão de UX — código preservado */}
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Horas" value={`${Number(m.hours_total).toFixed(1)} h`} />
              <Stat label="Investido" value={brl(totalCost)} />
            </div>
            {/* ── AÇÕES PRINCIPAIS ── */}
            {isOwner && !isArchived && (
              <div className="flex flex-col gap-3">
                <Button
                  className="btn-glow h-12 w-full text-sm gap-2"
                  onClick={() =>
                    navigate({
                      to: "/motorcycles/$id/registrar-manutencao" as never,
                      params: { id: m.id } as never,
                    })
                  }
                >
                  <Wrench className="h-4 w-4 shrink-0" />
                  Registrar manutenção
                </Button>
                <NewEventDialog
                  moto={m}
                  triggerLabel="Registrar atividade"
                  triggerClassName="btn-glow h-12 w-full text-sm gap-2"
                  open={autoOpenEvent}
                  onOpenChange={(v) => setAutoOpenEvent(v ? true : undefined)}
                />
              </div>
            )}

            {/* ── SAÚDE E DOCUMENTOS ── */}
            <div className="space-y-1">
              <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Saúde e documentos</p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                <Link to="/motorcycles/$id/checkups" params={{ id: m.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Check-ups e Laudos</p>
                    <p className="text-xs text-muted-foreground">Avaliação e resultado formal</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
                <Link to="/motorcycles/$id/passport" params={{ id: m.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Passaporte Digital</p>
                    <p className="text-xs text-muted-foreground">Apresentação e compartilhamento</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
                {isOwner && (
                  <Link to="/motorcycles/$id/certificate" params={{ id: m.id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Certificado Digital</p>
                      <p className="text-xs text-muted-foreground">Documento público configurável</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                )}
              </div>
            </div>

            {/* ── GESTÃO DA MOTO ── */}
            {isOwner && (
              <div className="space-y-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gestão</p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  <Link to="/motorcycles/$id/editar" params={{ id: m.id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">Editar dados da moto</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                  <Link to="/motorcycles/$id/components" params={{ id: m.id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <Wand2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">Componentes</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                  <PlanCatalogSyncDialog
                    moto={m}
                    trigger={
                      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left">
                        <Wand2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm font-medium">Atualizar plano com catálogo</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    }
                  />
                </div>
              </div>
            )}

            {/* ── PROPRIEDADE ── */}
            {isOwner && !isArchived && (
              <div className="space-y-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Propriedade</p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {pendingTransfer.data ? (
                    <div className="flex items-center gap-3 px-4 py-3 opacity-60">
                      <ArrowRightLeft className="h-4 w-4 shrink-0 text-amber-400" />
                      <span className="flex-1 text-sm font-medium text-amber-400">Transferência pendente</span>
                    </div>
                  ) : (
                    <TransferOwnershipDialog
                      motorcycleId={m.id}
                      trigger={
                        <button type="button" className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left">
                          <ArrowRightLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 text-sm font-medium">Transferir moto</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      }
                    />
                  )}
                  <EmitReceiptDialog
                    motorcycleId={m.id}
                    onIssued={() => {
                      qc.invalidateQueries({ queryKey: ["events", m.id] });
                      qc.invalidateQueries({ queryKey: ["ownership", m.id] });
                      qc.invalidateQueries({ queryKey: ["motorcycle_documents", m.id] });
                      qc.invalidateQueries({ queryKey: ["document-pendencies"] });
                      qc.invalidateQueries({ queryKey: ["active-negotiation", m.id] });
                      qc.invalidateQueries({ queryKey: ["smart-receipts", m.id] });
                    }}
                    trigger={
                      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors btn-glow text-left">
                        <FileSignature className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm font-medium">Vender / Emitir Recibo</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    }
                  />
                </div>
              </div>
            )}

            {/* ── ZONA DE RISCO ── */}
            {isOwner && (
              <div className="space-y-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Zona de risco</p>
                <div className="rounded-2xl border border-destructive/20 bg-card overflow-hidden divide-y divide-border">
                {isOwner && !isArchived && (
                  <AlertDialog
                    onOpenChange={(o) => {
                      if (!o) {
                        setArchiveReason("");
                        setArchiveReasonOther("");
                      }
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      >
                        <Archive className="h-4 w-4" /> Arquivar moto
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <Archive className="h-5 w-5" /> Arquivar esta motocicleta?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <span className="block">
                            Arquivar <strong>{m.nickname || m.model}</strong> remove-a da sua
                            garagem ativa, mas mantém o{" "}
                            <strong>
                              histórico, documentos, atividades, certificados e registros
                              preservados
                            </strong>
                            .
                          </span>
                          <span className="block">
                            Você poderá consultar ou restaurar esta moto futuramente. Se está{" "}
                            <strong>vendendo</strong>, prefira{" "}
                            <strong>Transferir Propriedade</strong>.
                          </span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Motivo do arquivamento
                        </label>
                        <Select value={archiveReason} onValueChange={setArchiveReason}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um motivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Venda da moto",
                              "Moto parada",
                              "Projeto em pausa",
                              "Cadastro duplicado",
                              "Troca de moto",
                              "Não utilizo mais",
                              "Organização da garagem",
                              "Outros motivos",
                            ].map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {archiveReason === "Outros motivos" && (
                          <Textarea
                            value={archiveReasonOther}
                            onChange={(e) => setArchiveReasonOther(e.target.value)}
                            placeholder="Descreva o motivo"
                            rows={3}
                          />
                        )}
                      </div>
                      {archiveReason &&
                        (archiveReason !== "Outros motivos" ||
                          archiveReasonOther.trim().length >= 3) && (
                          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
                            <div className="mb-1.5 font-semibold text-foreground">
                              Esta motocicleta será:
                            </div>
                            <ul className="space-y-1 text-muted-foreground">
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> removida
                                da garagem ativa
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> preservada
                                no histórico
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> documentos
                                mantidos
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> atividades
                                mantidas
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{" "}
                                certificados preservados
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> poderá ser
                                restaurada futuramente
                              </li>
                            </ul>
                          </div>
                        )}
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={
                            !archiveReason ||
                            (archiveReason === "Outros motivos" &&
                              archiveReasonOther.trim().length < 3)
                          }
                          onClick={archiveMoto}
                          className="disabled:opacity-40"
                        >
                          Arquivar moto
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isOwner && !isArchived && (
                  <AlertDialog
                    open={deleteOpen}
                    onOpenChange={(o) => {
                      setDeleteOpen(o);
                      if (!o) setDeleteWord("");
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" /> Excluir moto
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                          <Trash2 className="h-5 w-5" /> Excluir permanentemente?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3 text-sm">
                            <p>
                              <strong>Excluir</strong> é diferente de <strong>Arquivar</strong>. Ao
                              arquivar, a moto sai da garagem ativa mas todo o histórico fica
                              preservado — você pode restaurá-la a qualquer momento.
                            </p>
                            <p>
                              Ao excluir, <strong>{m.nickname || m.model}</strong> e seus{" "}
                              <strong>dados operacionais</strong> — manutenções, documentos,
                              fotos, atividades e agenda — serão apagados permanentemente.{" "}
                              <span className="font-semibold text-destructive">
                                Esta ação não pode ser desfeita.
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Laudos de Saúde TrailBook já emitidos são preservados como
                              evidência histórica e continuam verificáveis pelos seus códigos
                              públicos, mesmo após a exclusão da moto.
                            </p>
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                              Se a moto foi vendida ou está parada, considere{" "}
                              <strong>Arquivar</strong> em vez de excluir — o histórico dela pode
                              ser valioso no futuro.
                            </div>
                            <p className="text-muted-foreground">
                              Para confirmar, digite{" "}
                              <strong className="text-foreground">EXCLUIR</strong> abaixo.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Input
                        value={deleteWord}
                        onChange={(e) => setDeleteWord(e.target.value.toUpperCase())}
                        placeholder="EXCLUIR"
                        autoFocus
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button
                          variant="destructive"
                          disabled={deleteWord !== "EXCLUIR"}
                          onClick={deleteMoto}
                          className="disabled:opacity-40"
                        >
                          Excluir permanentemente
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeNegotiation.data && (
        <ActiveNegotiationCard motoId={m.id} negotiation={activeNegotiation.data} />
      )}

      {/* ── Navegação por cards ── */}
      <div className="w-full">
        {/* Botão Voltar ao menu (visível em qualquer seção interna) */}
        {view !== "menu" && (
          <button
            type="button"
            onClick={() => { setView("menu"); setLancamentoFilter("menu"); setActivitySearch(""); }}
            className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Voltar ao menu
          </button>
        )}

        {/* ── MENU: Grid de cards ── */}
        {view === "menu" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Painel */}
            <button
              type="button"
              onClick={() => setView("geral")}
              className="surface-elevated group flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-primary/40 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold leading-tight">Painel</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Saúde e próx. revisões</div>
              </div>
            </button>

            {/* Check-up */}
            <button
              type="button"
              onClick={() => setView("checkup")}
              className="surface-elevated group flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-primary/40 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold leading-tight">Check-up</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Avaliar e registrar inspeção</div>
              </div>
            </button>

            {/* Peças & Componentes (só para owner) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setView("componentes")}
                className="surface-elevated group flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-primary/40 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold leading-tight">Peças</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Componentes instalados</div>
                </div>
              </button>
            )}

            {/* Lançamentos */}
            <button
              type="button"
              onClick={() => setView("atividade")}
              className="surface-elevated group flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-amber-400/40 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold leading-tight">Lançamentos</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Editar ou excluir registros</div>
              </div>
            </button>

            {/* Documentos */}
            <button
              type="button"
              onClick={() => setView("documentos")}
              className="surface-elevated group flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-primary/40 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold leading-tight">Documentos</div>
                <div className="mt-0.5 text-xs text-muted-foreground">CRLV, laudos e arquivos</div>
              </div>
            </button>
          </div>
        )}

        {/* ── SEÇÃO: Painel (ex-Visão Geral) ── */}
        {view === "geral" && <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Saúde da moto</h2>
              <Link
                to="/motorcycles/$id/health"
                params={{ id: m.id }}
                className="text-xs text-primary hover:underline"
              >
                Abrir check-up completo
              </Link>
            </div>
            <HealthOverview moto={m as any} isOwner={isOwner} collapsible showLastReport={false} />
          </section>

          <Accordion type="single" collapsible defaultValue="proximas" className="space-y-3">
            <AccordionItem
              value="proximas"
              className="rounded-2xl border border-border bg-card px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <span className="font-display text-lg font-bold">Próximas manutenções</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-3">
                    {statuses.length === 0 ? (
                      <div className="surface-elevated rounded-2xl p-6 text-sm text-muted-foreground">
                        Nenhuma programação ainda. Use <strong>Programações</strong> para aplicar o
                        catálogo recomendado.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {statuses.slice(0, 6).map((s) => {
                          const Icon =
                            s.status === "overdue"
                              ? AlertTriangle
                              : s.status === "due"
                                ? AlertTriangle
                                : s.status === "soon"
                                  ? Clock
                                  : CheckCircle2;
                          const color =
                            s.status === "overdue"
                              ? "text-destructive"
                              : s.status === "due"
                                ? "text-amber-400"
                                : s.status === "soon"
                                  ? "text-amber-300"
                                  : "text-emerald-400";
                          return (
                            <li key={s.schedule.id} className="surface-elevated rounded-2xl p-3">
                              <div className="flex items-start gap-3">
                                <Icon className={`mt-0.5 h-4 w-4 ${color}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <div className="min-w-0 truncate font-medium">{s.label}</div>
                                    <div className={`shrink-0 text-xs ${color}`}>
                                      {s.status === "overdue"
                                        ? "Vencida"
                                        : s.status === "due"
                                          ? "Vence agora"
                                          : s.status === "soon"
                                            ? "Em breve"
                                            : "Em dia"}
                                    </div>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                    {s.remaining.hours != null && (
                                      <span>{s.remaining.hours.toFixed(1)} h restantes</span>
                                    )}
                                    {s.remaining.days != null && (
                                      <span>{Math.round(s.remaining.days)} dias restantes</span>
                                    )}
                                    {s.estimatedDueDate && (
                                      <span>
                                        · estimado {s.estimatedDueDate.toLocaleDateString("pt-BR")}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full ${s.status === "overdue" || s.status === "due" ? "bg-destructive" : s.status === "soon" ? "bg-amber-400" : "bg-emerald-400"}`}
                                      style={{ width: `${Math.min(100, s.progress * 100)}%` }}
                                    />
                                  </div>
                                  <div className="mt-2 flex justify-end">
                                    {isOwner && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setInspectTarget({
                                            id: s.schedule.id,
                                            name: s.label,
                                            category: s.schedule.category,
                                          })
                                        }
                                      >
                                        <ClipboardCheck className="h-3.5 w-3.5" /> Inspecionar
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Modo técnico · visível apenas para administradores
                      </p>
                      <ConservationCard result={conservation} />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>}

        {/* ── SEÇÃO: Check-up ── */}
        {view === "checkup" && <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Check-up e Laudo</h2>
              <Link
                to="/motorcycles/$id/checkups"
                params={{ id: m.id }}
                className="text-xs text-primary hover:underline"
              >
                Ver histórico completo
              </Link>
            </div>
            <LastReportCard motoId={m.id} />
          </section>
        </div>}

        {/* ── SEÇÃO: Peças & Componentes ── */}
        {isOwner && view === "componentes" && <div className="space-y-8">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold">Componentes</h2>
                <Link
                  to="/motorcycles/$id/components"
                  params={{ id: m.id }}
                  className="text-xs text-primary hover:underline"
                >
                  Ver todos
                </Link>
              </div>
              <ComponentsList moto={m as any} isOwner={isOwner} limitPerCategory={3} />
            </section>
        </div>}

        {/* ── SEÇÃO: Lançamentos ── */}
        {view === "atividade" && <div className="space-y-4">

          {/* Botão Voltar para o sub-menu de Lançamentos */}
          {lancamentoFilter !== "menu" && (
            <button
              type="button"
              onClick={() => { setLancamentoFilter("menu"); setActivitySearch(""); }}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              Categorias de lançamentos
            </button>
          )}

          {/* ── SUB-MENU: Grid de categorias ── */}
          {lancamentoFilter === "menu" && (() => {
            const cats = [
              { key: "maintenance" as const, emoji: "🔧", label: "Manutenções", desc: "Revisões, trocas e reparos", color: "bg-orange-500/10 text-orange-500" },
              { key: "usage"       as const, emoji: "🏍", label: "Uso",          desc: "Horas de uso registradas", color: "bg-primary/10 text-primary" },
              { key: "incident"    as const, emoji: "⚠️", label: "Sinistros",    desc: "Quedas, roubos e avarias", color: "bg-destructive/10 text-destructive" },
              { key: "accessory"   as const, emoji: "🎽", label: "Acessórios",   desc: "Equipamentos e proteções", color: "bg-sky-500/10 text-sky-500" },
              { key: "note"        as const, emoji: "📝", label: "Notas",        desc: "Observações e registros livres", color: "bg-violet-500/10 text-violet-500" },
            ];
            const countFor = (key: string) => {
              if (!events.data) return null;
              const n = events.data.filter((e: any) =>
                key === "maintenance"
                  ? e.type === "maintenance" || e.type === "revision"
                  : e.type === key
              ).length;
              return n;
            };
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selecione uma categoria para ver, editar ou excluir os registros.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {cats.map(({ key, emoji, label, desc, color }) => {
                    const count = countFor(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLancamentoFilter(key)}
                        className="surface-elevated flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-primary/40 active:scale-[0.98]"
                      >
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-lg", color)}>
                          {emoji}
                        </div>
                        <div className="min-w-0 w-full">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold leading-tight">{label}</span>
                            {count !== null && count > 0 && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {count}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── LISTA FILTRADA por categoria ── */}
          {lancamentoFilter !== "menu" && (() => {
            const catLabels: Record<string, string> = {
              maintenance: "🔧 Manutenções",
              usage: "🏍 Uso",
              incident: "⚠️ Sinistros",
              accessory: "🎽 Acessórios",
              note: "📝 Notas",
            };
            const filterFn = (e: any) => {
              const typeMatch =
                lancamentoFilter === "maintenance"
                  ? e.type === "maintenance" || e.type === "revision"
                  : e.type === lancamentoFilter;
              if (!typeMatch) return false;
              if (activitySearch.trim()) {
                const q = activitySearch.toLowerCase();
                return (
                  e.title?.toLowerCase().includes(q) ||
                  e.location?.toLowerCase().includes(q) ||
                  e.description?.toLowerCase().includes(q)
                );
              }
              return true;
            };

            return (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold">{catLabels[lancamentoFilter]}</h3>
                  {isOwner && !isArchived && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Pencil className="h-3 w-3 shrink-0" /> Edite ou exclua abaixo de cada item
                    </p>
                  )}
                </div>

                {/* Busca dentro da categoria */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar nesta categoria…"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      className="h-9 w-full rounded-xl border border-border bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {activitySearch && (
                    <button
                      onClick={() => setActivitySearch("")}
                      className="rounded-xl border border-border bg-card px-3 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {events.isLoading ? (
                  <ol className="relative space-y-4 border-l border-border pl-6" aria-hidden="true">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[34px] top-2 h-3 w-3 rounded-full bg-primary/40 ring-4 ring-background" />
                        <div className="surface-elevated rounded-2xl p-4">
                          <div className="h-4 w-1/3 animate-pulse rounded bg-primary/10" />
                          <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-primary/10" />
                          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-primary/10" />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (() => {
                  const filtered = (events.data ?? []).filter(filterFn);
                  if (filtered.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          {activitySearch
                            ? `Nenhum resultado para "${activitySearch}"`
                            : "Nenhum registro nesta categoria ainda."}
                        </p>
                        {activitySearch && (
                          <button onClick={() => setActivitySearch("")} className="mt-2 text-xs text-primary hover:underline">
                            Limpar busca
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <ol className="relative space-y-4 border-l border-border pl-6">
                      {filtered.map((e: any) => (
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
                                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                  {EVENT_TYPE_LABEL[e.type]}
                                </div>
                                {e.description && (
                                  <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  {e.hours_at_event != null && <span>{Number(e.hours_at_event).toFixed(1)} h</span>}
                                  {e.location && <span>{e.location}</span>}
                                  {e.cost != null && (
                                    <span className="font-semibold text-primary">{brl(Number(e.cost))}</span>
                                  )}
                                </div>
                                {(() => {
                                  const meta = (e.metadata ?? {}) as Record<string, unknown>;
                                  const code = typeof meta.receipt_code === "string" ? meta.receipt_code : null;
                                  if (e.type !== "ownership_transfer" || !code) return null;
                                  return (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      <Button size="sm" variant="outline" onClick={() => openReceiptPdf(code, "signed")}>
                                        <Eye className="h-3.5 w-3.5" /> Visualizar recibo
                                      </Button>
                                    </div>
                                  );
                                })()}
                                {isOwner && !isArchived && (
                                  <div className="mt-3 border-t border-border pt-3">
                                    <EventActionsMenu
                                      event={e as any}
                                      variant="inline"
                                      onChanged={() => {
                                        qc.invalidateQueries({ queryKey: ["events", id] });
                                        qc.invalidateQueries({ queryKey: ["motorcycle", id] });
                                        qc.invalidateQueries({ queryKey: ["usage-history-avg", id] });
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  );
                })()}
              </section>
            );
          })()}
        </div>}

        {/* ── SEÇÃO: Documentos ── */}
        {view === "documentos" && <div className="space-y-8">
          <MotorcyclePhotos motorcycleId={m.id} />
          <MotorcycleDocuments motorcycleId={m.id} />
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold">Recibos & Transferências</h2>
            <ReceiptsSummaryRow
              motoId={m.id}
              isOwner={isOwner && !isArchived}
              count={(receiptsForMoto.data ?? []).length}
            />
          </section>
        </div>}
      </div>

      {isAdmin && (
        <AdminMotoDangerZone
          motoId={m.id}
          isHomologation={!!(m as any).is_homologation}
          label={m.nickname || m.model}
        />
      )}

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

      <InitialReviewSheet
        motoId={m.id}
        motoHours={Number(m.hours_total) || 0}
        motoKm={Number(m.km_total) || 0}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 min-w-0 overflow-hidden">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate mb-0.5">
        {label}
      </div>
      <div className="font-display font-bold text-sm leading-tight truncate">{value}</div>
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
