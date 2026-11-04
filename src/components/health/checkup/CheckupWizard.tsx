import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FileText, Info, Loader2, QrCode, Settings2, ShieldAlert, ShieldOff, Store, Timer, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TBButton, TBCard, TBErrorState, TBLoadingState, TBStatusPill } from "@/design-system";
import { useHealthSnapshot } from "@/hooks/useHealthSnapshot";
import { checkEmission } from "@/lib/health-reports/gating";
import { computeValidity } from "@/lib/health-reports/validity";
import { buildReportSnapshot } from "@/lib/health-reports/snapshot";
import {
  DOCS_QR_VALIDITY_OPTIONS,
  REPORT_PURPOSE_DEFAULT_TITLE,
  REPORT_PURPOSE_DESCRIPTION,
  REPORT_PURPOSE_LABEL,
  type DocsQrValidityDays,
  type HealthReportSnapshot,
  type ReportEmissionConfig,
  type ReportPurpose,
} from "@/lib/health-reports/types";
import { issueHealthReport, startCheckRun, updateCheckRun } from "@/lib/health-reports.functions";
import { createDocumentShare } from "@/lib/document-shares.functions";
import { ReportSnapshotView } from "@/components/health/reports/ReportSnapshotView";
import { trackHealth } from "@/lib/health-reports/telemetry";
import { useModule } from "@/hooks/useModules";
import { shareUrl } from "@/lib/external-links";
import { FISCAL_DEFAULT_MINUTES, FISCAL_EXPIRY_OPTIONS, FISCAL_PRIVACY_NOTICE } from "@/lib/health-reports/sections";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

const STEPS = ["Identificação", "Revisão", "Análise", "Condições", "Configurar", "Prévia", "Emissão"] as const;

const PURPOSE_ICONS: Record<ReportPurpose, React.ElementType> = {
  comercial: Store,
  oficina: Wrench,
  pessoal: FileText,
};

// ── Helpers fiscalização ────────────────────────────────────────
function newFiscalToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function minutesToIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type FiscalShareRow = {
  id: string;
  public_token: string;
  expires_at: string | null;
  revoked_at: string | null;
};

/** Tela de fiscalização embutida no wizard — gera acesso temporário sem emitir laudo. */
function FiscalWizardStep({ motoId, latestReportId }: { motoId: string; latestReportId: string | null }) {
  const qc = useQueryClient();
  const fiscalModule = useModule("fiscalizacao");
  const [selectedMinutes, setSelectedMinutes] = useState(FISCAL_DEFAULT_MINUTES);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const shares = useQuery<FiscalShareRow[]>({
    queryKey: ["fiscal-wizard-shares", latestReportId],
    queryFn: async () => {
      if (!latestReportId) return [];
      const { data } = await supabase
        .from("health_report_shares")
        .select("id, public_token, expires_at, revoked_at")
        .eq("report_id", latestReportId)
        .eq("preset", "fiscal" as never)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as FiscalShareRow[];
    },
    enabled: !!latestReportId,
  });

  const active = (shares.data ?? []).filter(
    (s) => !s.revoked_at && s.expires_at && new Date(s.expires_at) > new Date(),
  );

  const generateQr = useCallback(async (token: string) => {
    if (qrMap[token]) return;
    try {
      const url = shareUrl(`/l/${token}`);
      const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 });
      setQrMap((m) => ({ ...m, [token]: dataUrl }));
    } catch { /* opcional */ }
  }, [qrMap]);

  const create = useMutation({
    mutationFn: async () => {
      if (!latestReportId) throw new Error("Nenhum laudo válido encontrado para esta moto.");
      const session = await supabase.auth.getSession();
      const uid = session.data.session?.user.id ?? "";
      const token = newFiscalToken();
      const { error } = await supabase.from("health_report_shares").insert({
        report_id: latestReportId,
        created_by: uid,
        preset: "fiscal" as never,
        allowed_sections: ["identification", "summary"] as never,
        public_token: token,
        expires_at: minutesToIso(selectedMinutes),
      });
      if (error) throw new Error(error.message);
      return token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["fiscal-wizard-shares", latestReportId] });
      toast.success("Acesso gerado. Mostre o QR Code ao fiscal.");
      generateQr(token);
      trackHealth("acesso_fiscal_gerado", { motoId, minutos: selectedMinutes });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("health_report_shares")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "Revogado pelo proprietário" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-wizard-shares", latestReportId] });
      toast.success("Acesso revogado.");
    },
  });

  const shareOrCopy = async (token: string) => {
    const url = shareUrl(`/l/${token}`);
    if (navigator.share) {
      try { await navigator.share({ title: "Acesso para Fiscalização — TrailBook", url }); }
      catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    }
  };

  const downloadPdf = async (token: string) => {
    try {
      const { getPublicHealthReport } = await import("@/lib/health-reports.functions");
      const { buildFiscalPdf } = await import("@/lib/health-reports/fiscal-pdf");
      const res = await getPublicHealthReport({ data: { token } });
      if (!res.ok) { toast.error("Não foi possível gerar o PDF."); return; }
      const blob = await buildFiscalPdf({
        snapshot: res.snapshot,
        code: res.code,
        issuedAt: res.issuedAt,
        status: res.status,
        fiscal: res.fiscal,
        fiscalToken: token,
        docImageDataUrl: null,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fiscalizacao-${res.code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Erro ao gerar PDF."); }
  };

  if (!latestReportId) {
    return (
      <TBCard className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-base font-black">Acesso para Fiscalização</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Esta moto ainda não possui um laudo válido emitido. Emita um Check-up primeiro para
          poder gerar um acesso de fiscalização.
        </p>
      </TBCard>
    );
  }

  if (fiscalModule.status === "maintenance") {
    return (
      <TBCard className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-base font-black">Acesso para Fiscalização</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Este recurso está temporariamente em manutenção. Tente novamente em instantes.
        </p>
      </TBCard>
    );
  }

  return (
    <div className="space-y-4">
      <TBCard className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-base font-black">Acesso para Fiscalização</h2>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{FISCAL_PRIVACY_NOTICE}</p>

        {/* Seletor de validade */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Validade do acesso</p>
          <div className="grid grid-cols-2 gap-2">
            {FISCAL_EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => setSelectedMinutes(opt.minutes)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition",
                  selectedMinutes === opt.minutes
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <TBButton
          className="w-full"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          {create.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</>
            : <><QrCode className="mr-2 h-4 w-4" /> Gerar QR Code</>
          }
        </TBButton>
      </TBCard>

      {/* Acessos ativos */}
      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Acessos ativos
          </p>
          {active.map((s) => {
            if (!qrMap[s.public_token]) generateQr(s.public_token);
            const qrImg = qrMap[s.public_token];
            return (
              <TBCard key={s.id} className="space-y-4">
                {/* QR Code grande, centralizado */}
                {qrImg
                  ? <img src={qrImg} alt="QR Code fiscal" className="mx-auto rounded-xl w-56 h-56 bg-white p-2" />
                  : <div className="mx-auto w-56 h-56 rounded-xl bg-muted animate-pulse" />
                }

                {/* Expiração */}
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4 shrink-0" />
                  <span>
                    Expira em <strong>{s.expires_at ? formatExpiry(s.expires_at) : "?"}</strong>
                  </span>
                </div>

                {/* Ações */}
                <div className="grid grid-cols-2 gap-2">
                  <TBButton variant="outline" onClick={() => shareOrCopy(s.public_token)}>
                    Compartilhar
                  </TBButton>
                  <TBButton variant="outline" onClick={() => downloadPdf(s.public_token)}>
                    Baixar PDF
                  </TBButton>
                </div>

                <TBButton
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/10"
                  onClick={() => revoke.mutate(s.id)}
                  disabled={revoke.isPending}
                >
                  <ShieldOff className="mr-2 h-4 w-4" /> Revogar acesso
                </TBButton>
              </TBCard>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center px-4 leading-relaxed">
        Este acesso foi gerado voluntariamente pelo proprietário e possui validade temporária.
        Não substitui documento oficial governamental.
      </p>
    </div>
  );
}

const DEFAULT_EMISSION_CONFIG: ReportEmissionConfig = {
  purpose: "pessoal",
  customTitle: "",
  includeDocsQr: false,
  docsQrValidityDays: 30,
};

export function CheckupWizard({ motoId, uid }: { motoId: string; uid: string | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const health = useHealthSnapshot(motoId, uid);
  const start = useServerFn(startCheckRun);
  const update = useServerFn(updateCheckRun);
  const issue = useServerFn(issueHealthReport);
  const fiscalModule = useModule("fiscalizacao");
  const fiscalEnabled = fiscalModule.status === "active" || fiscalModule.status === "beta";
  const fiscalBeta = fiscalModule.status === "beta";

  // Modo fiscalização: fluxo independente, sem emitir laudo
  const [fiscalMode, setFiscalMode] = useState(false);

  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [issuedAtRef] = useState(() => new Date().toISOString());
  const [emissionConfig, setEmissionConfig] = useState<ReportEmissionConfig>(DEFAULT_EMISSION_CONFIG);
  const shareCreate = useServerFn(createDocumentShare);

  // Último laudo válido — usado pelo modo Fiscalização para criar share sem emitir novo laudo
  const { data: latestReportId } = useQuery<string | null>({
    queryKey: ["latest-report-id", motoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_reports")
        .select("id")
        .eq("motorcycle_id", motoId)
        .in("status", ["valid", "expiring"])
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    },
    enabled: fiscalMode || fiscalEnabled,
  });

  // Contagem de documentos ativos desta moto — usado para avisar antes de habilitar o QR Code
  const { data: docCount } = useQuery({
    queryKey: ["moto-doc-count", motoId],
    queryFn: async () => {
      const { count } = await supabase
        .from("motorcycle_documents" as never)
        .select("id", { count: "exact", head: true })
        .eq("motorcycle_id" as never, motoId as never)
        .eq("is_current" as never, true as never)
        .is("deleted_at" as never, null);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!uid) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => setOwnerName((data as { full_name?: string } | null)?.full_name ?? null));
  }, [uid]);

  const gating = useMemo(() => {
    if (!health.moto) return null;
    return checkEmission({
      moto: health.moto,
      snapshot: health.snapshot,
      maxRecordedHours: health.maxRecordedHours,
      maxRecordedKm: health.maxRecordedKm,
    });
  }, [health.moto, health.snapshot, health.maxRecordedHours, health.maxRecordedKm]);

  const validity = useMemo(() => {
    if (!health.snapshot || !health.moto || !gating) return null;
    return computeValidity({
      snapshot: health.snapshot,
      confidenceLevel: gating.confidenceLevel,
      hoursTotal: Number(health.moto.hours_total ?? 0),
      kmTotal: Number(health.moto.km_total ?? 0),
    });
  }, [health.snapshot, health.moto, gating]);

  const previewSnapshot: HealthReportSnapshot | null = useMemo(() => {
    if (!health.moto || !health.snapshot || !gating || !validity) return null;
    const base = buildReportSnapshot({
      moto: health.moto,
      snapshot: health.snapshot,
      events: health.events,
      inspections: health.inspections,
      issuedBy: { id: uid ?? "", name: ownerName },
      owner: { id: uid ?? "", name: ownerName },
      confidenceLevel: gating.confidenceLevel,
      reservations: gating.reservations,
      conflicts: gating.conflicts,
      missingData: gating.missingData,
      validity,
      issuedAt: issuedAtRef,
    });
    return {
      ...base,
      purpose: emissionConfig.purpose,
      reportTitle: emissionConfig.customTitle.trim()
        || REPORT_PURPOSE_DEFAULT_TITLE[emissionConfig.purpose],
    };
  }, [
    health.moto,
    health.snapshot,
    health.events,
    health.inspections,
    gating,
    validity,
    uid,
    ownerName,
    issuedAtRef,
    emissionConfig.purpose,
    emissionConfig.customTitle,
  ]);

  // Abre o Check-up assim que a tela é montada (chave de idempotência da emissão).
  useEffect(() => {
    if (runId || !health.moto) return;
    start({ data: { motorcycleId: motoId } })
      .then((r) => {
        setRunId(r.runId);
        trackHealth("checkup_iniciado", { motoId });
      })
      .catch(() => toast.error("Não foi possível iniciar o Check-up. Tente novamente."));
  }, [health.moto, motoId, runId, start]);

  if (health.isLoading) return <TBLoadingState label="Reunindo os registros da sua moto…" />;
  if (health.error || !health.moto) {
    return <TBErrorState title="Não conseguimos abrir o Check-up" onRetry={health.refetch} />;
  }

  const moto = health.moto;

  const runAnalysis = async () => {
    setAnalyzing(true);
    setStep(2);
    if (runId) await update({ data: { runId, status: "processing" } }).catch(() => null);
    // A análise já está calculada pela TIL; a pausa é apenas para o usuário acompanhar.
    setTimeout(async () => {
      setAnalyzing(false);
      if (runId) {
        await update({
          data: {
            runId,
            status: gating?.mode === "blocked" ? "blocked" : "previewed",
            blockers: gating?.blockers ?? [],
            warnings: gating?.reservations ?? [],
          },
        }).catch(() => null);
      }
      trackHealth(gating?.mode === "blocked" ? "emissao_bloqueada" : "analise_concluida", {
        motoId,
        blockers: gating?.blockers?.length ?? 0,
        reservas: gating?.reservations?.length ?? 0,
      });
      setStep(3);
    }, 900);
  };

  const emit = async () => {
    if (!runId || !previewSnapshot || !validity || !gating) return;
    setIssuing(true);
    try {
      // 1. Emite o laudo (snapshot sem docsQrUrl ainda — URL ainda não existe)
      const res = await issue({
        data: {
          runId,
          motorcycleId: motoId,
          snapshot: previewSnapshot,
          confidenceLevel: gating.confidenceLevel,
          reservations: gating.reservations,
          validity: {
            validUntil: validity.validUntil,
            hoursLimit: validity.hoursLimit,
            kmLimit: validity.kmLimit,
            reason: validity.reason,
          },
          accepted,
        },
      });

      // 2. Se QR Code habilitado, cria o token de compartilhamento de documentos.
      // O token é armazenado em motorcycle_document_shares e lido na hora de gerar
      // o PDF — o snapshot é imutável (trigger health_snapshots_no_update) e não
      // pode ser atualizado após emissão.
      if (emissionConfig.includeDocsQr && res.report?.id) {
        try {
          await shareCreate({
            data: {
              motorcycleId: motoId,
              reportId: res.report.id,
              validityDays: emissionConfig.docsQrValidityDays,
            },
          });
        } catch {
          // QR Code é melhor-esforço; não bloqueia emissão do laudo
          toast.error("QR Code de documentos não pôde ser gerado. O laudo foi emitido normalmente.");
        }
      }

      await qc.invalidateQueries({ queryKey: ["health-reports", motoId] });
      await qc.invalidateQueries({ queryKey: ["health-report-last", motoId] });
      toast.success(
        res.reused ? "Este Check-up já havia sido emitido." : "Laudo emitido com sucesso.",
      );
      trackHealth("laudo_emitido", {
        motoId,
        code: String(res.report.code ?? ""),
        reused: !!res.reused,
      });
      navigate({
        to: "/motorcycles/$id/checkups/$code",
        params: { id: motoId, code: String(res.report.code ?? "") },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível emitir o laudo.");
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Progresso */}
      <ol className="flex items-center gap-1" aria-label="Etapas do Check-up">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full",
                i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "mt-1 block text-[10px]",
                i === step ? "font-bold" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <TBCard className="space-y-3">
          <h2 className="text-base font-black">Confirme a moto avaliada</h2>
          <p className="text-sm text-muted-foreground">
            O laudo será emitido para esta motocicleta. Confira os dados antes de continuar.
          </p>
          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <div className="font-bold">
              {moto.brand} {moto.model}
            </div>
            <div className="text-muted-foreground">
              {moto.nickname ? `${moto.nickname} · ` : ""}
              {moto.plate ?? "sem placa"} · {Number(moto.hours_total ?? 0)} h ·{" "}
              {Number(moto.km_total ?? 0)} km
            </div>
          </div>
          <TBButton onClick={() => setStep(1)}>Continuar</TBButton>
        </TBCard>
      )}

      {step === 1 && (
        <TBCard className="space-y-3">
          <h2 className="text-base font-black">Os dados estão atualizados?</h2>
          <p className="text-sm text-muted-foreground">
            O laudo usa apenas o que já está registrado no TrailBook. Se algo estiver desatualizado,
            registre antes de continuar — o resultado fica muito mais confiável.
          </p>
          <ul className="space-y-1 text-sm">
            <li>
              Horímetro atual: <strong>{Number(moto.hours_total ?? 0)} h</strong>
            </li>
            <li>
              Odômetro atual: <strong>{Number(moto.km_total ?? 0)} km</strong>
            </li>
            <li>
              Atividades registradas: <strong>{health.events.length}</strong>
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <TBButton variant="outline" asChild>
              <Link to="/motorcycles/$id" params={{ id: motoId }}>
                Atualizar dados da moto
              </Link>
            </TBButton>
            <TBButton onClick={runAnalysis}>Analisar agora</TBButton>
          </div>
        </TBCard>
      )}

      {step === 2 && (
        <TBCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-semibold">Analisando os registros da sua moto…</p>
          <p className="text-sm text-muted-foreground">
            Estamos revisando componentes, manutenções e evidências. Isso leva poucos segundos.
          </p>
          {!analyzing && <TBButton onClick={() => setStep(3)}>Ver resultado</TBButton>}
        </TBCard>
      )}

      {step === 3 && gating && (
        <div className="space-y-3">
          {gating.mode === "blocked" ? (
            <TBCard className="space-y-3 border-destructive/40 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                <h2 className="text-base font-black">Ainda não é possível emitir o laudo</h2>
              </div>
              <ul className="space-y-3">
                {gating.blockers.map((b) => (
                  <li key={b.code} className="text-sm">
                    <span className="font-semibold">{b.title}</span>
                    <span className="block text-muted-foreground">{b.fix}</span>
                  </li>
                ))}
              </ul>
              <TBButton asChild variant="outline">
                <Link
                  to={
                    gating.blockers.some((b) => b.code === "no_identification")
                      ? "/motorcycles/$id/editar"
                      : "/motorcycles/$id"
                  }
                  params={{ id: motoId }}
                >
                  Resolver pendências
                </Link>
              </TBButton>
            </TBCard>
          ) : (
            <TBCard className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black">Análise concluída</h2>
                {health.snapshot && (
                  <TBStatusPill status={health.snapshot.health.status} size="sm" />
                )}
              </div>
              {gating.mode === "with_reservations" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    O laudo pode ser emitido, mas com ressalvas. Elas ficam registradas no documento
                    com total transparência.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {gating.reservations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ressalva identificada. Os registros estão consistentes.
                </p>
              )}
              <TBButton onClick={() => setStep(4)}>Configurar laudo</TBButton>
            </TBCard>
          )}
        </div>
      )}

      {/* ── Step 4: Configurar laudo ─────────────────────────────── */}
      {step === 4 && (
        <TBCard className="space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="text-base font-black">Configurar laudo</h2>
          </div>

          {/* Finalidade */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Finalidade do laudo</p>
            <div className="grid grid-cols-2 gap-2">
              {(["comercial", "oficina", "pessoal"] as ReportPurpose[]).map((p) => {
                const Icon = PURPOSE_ICONS[p];
                const active = !fiscalMode && emissionConfig.purpose === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setFiscalMode(false);
                      setEmissionConfig((c) => ({
                        ...c,
                        purpose: p,
                        includeDocsQr: p === "comercial" ? true : p === "oficina" ? false : c.includeDocsQr,
                      }));
                    }}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/30 hover:border-primary/40",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                    <span className={cn("text-sm font-semibold", active ? "text-primary" : "")}>
                      {REPORT_PURPOSE_LABEL[p]}
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug">
                      {REPORT_PURPOSE_DESCRIPTION[p]}
                    </span>
                  </button>
                );
              })}

              {/* Quarto card — Fiscalização (módulo controlado) */}
              {fiscalEnabled && (
                <button
                  type="button"
                  onClick={() => setFiscalMode(true)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors",
                    fiscalMode
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30 hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className={cn("h-4 w-4", fiscalMode ? "text-primary" : "text-muted-foreground")} aria-hidden />
                    {fiscalBeta && (
                      <span className="rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wide">β</span>
                    )}
                  </div>
                  <span className={cn("text-sm font-semibold", fiscalMode ? "text-primary" : "")}>
                    Fiscalização
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    Identificação da moto e situação geral — acesso temporário para fiscalização.
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Título personalizado */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold" htmlFor="report-title">
              Título personalizado <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="report-title"
              type="text"
              value={emissionConfig.customTitle}
              onChange={(e) => setEmissionConfig((c) => ({ ...c, customTitle: e.target.value }))}
              placeholder={REPORT_PURPOSE_DEFAULT_TITLE[emissionConfig.purpose]}
              maxLength={80}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, usa o título padrão: <strong>{REPORT_PURPOSE_DEFAULT_TITLE[emissionConfig.purpose]}</strong>
            </p>
          </div>

          {/* QR Code de documentos */}
          <div className="space-y-3 rounded-xl border border-border p-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold">Incluir QR Code de documentos</p>
                <p className="text-xs text-muted-foreground">
                  Gera um QR Code no laudo que dá acesso ao cofre de documentos da moto
                  (Nota Fiscal, CRLV, laudos de oficina e demais anexos).
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={emissionConfig.includeDocsQr}
                onChange={(e) => setEmissionConfig((c) => ({ ...c, includeDocsQr: e.target.checked }))}
              />
            </label>

            {/* Aviso: moto sem documentos cadastrados */}
            {docCount === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="space-y-1">
                  <p className="font-semibold">Esta moto não possui documentos cadastrados.</p>
                  <p>
                    O QR Code será gerado, mas quem escanear verá um cofre vazio.{" "}
                    <Link
                      to="/motorcycles/$id"
                      params={{ id: motoId }}
                      className="underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200"
                    >
                      Adicione documentos antes de emitir
                    </Link>{" "}
                    para aproveitar este recurso.
                  </p>
                </div>
              </div>
            )}

            {emissionConfig.includeDocsQr && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-sm font-semibold">Validade do acesso</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DOCS_QR_VALIDITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setEmissionConfig((c) => ({ ...c, docsQrValidityDays: opt.days as DocsQrValidityDays }))}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-colors",
                        emissionConfig.docsQrValidityDays === opt.days
                          ? "border-primary bg-primary/5 font-semibold text-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {fiscalMode ? (
            <TBButton className="w-full" onClick={() => setStep(5)}>
              <ShieldAlert className="mr-2 h-4 w-4" /> Gerar acesso para fiscalização
            </TBButton>
          ) : (
            <TBButton className="w-full" onClick={() => setStep(5)}>
              Ver prévia do laudo
            </TBButton>
          )}
        </TBCard>
      )}

      {/* ── Step 5 (Fiscalização): QR Code + compartilhar ─────── */}
      {step === 5 && fiscalMode && (
        <FiscalWizardStep motoId={motoId} latestReportId={latestReportId ?? null} />
      )}

      {/* ── Step 5: Prévia do laudo (apenas modo normal) ─────────── */}
      {step === 5 && !fiscalMode && previewSnapshot && (
        <div className="space-y-4">
          <TBCard className="space-y-1">
            <h2 className="text-base font-black">Prévia do laudo</h2>
            <p className="text-sm text-muted-foreground">
              Este é exatamente o conteúdo que será registrado com a finalidade e configurações
              escolhidas. Depois de emitido, o laudo não pode ser alterado.
            </p>
          </TBCard>
          <ReportSnapshotView snapshot={previewSnapshot} purpose={emissionConfig.purpose} />
          <TBButton className="w-full" onClick={() => setStep(6)}>
            Confirmar e emitir
          </TBButton>
        </div>
      )}

      {step === 6 && !fiscalMode && previewSnapshot && validity && (
        <TBCard className="space-y-4">
          <h2 className="text-base font-black">Confirmação de emissão</h2>
          <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Finalidade:</span> <strong>{REPORT_PURPOSE_LABEL[emissionConfig.purpose]}</strong></p>
            <p><span className="text-muted-foreground">Título:</span> <strong>{emissionConfig.customTitle.trim() || REPORT_PURPOSE_DEFAULT_TITLE[emissionConfig.purpose]}</strong></p>
            {emissionConfig.includeDocsQr && (
              <p><span className="text-muted-foreground">QR de documentos:</span> <strong>
                {DOCS_QR_VALIDITY_OPTIONS.find((o) => o.days === emissionConfig.docsQrValidityDays)?.label ?? "30 dias"}
              </strong></p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{validity.label}</p>
          <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Declaro que as informações registradas no TrailBook são verdadeiras e que este laudo
              reflete apenas os dados existentes até esta data. Ele não substitui inspeção mecânica
              presencial.
            </span>
          </label>
          <TBButton className="w-full" disabled={!accepted || issuing || !runId} onClick={emit}>
            {issuing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            {issuing ? "Emitindo laudo…" : "Emitir laudo"}
          </TBButton>
        </TBCard>
      )}

      {step > 0 && step !== 2 && !issuing && (
        <TBButton variant="ghost" onClick={() => setStep((s) => Math.max(0, s === 3 ? 1 : s - 1))}>
          Voltar
        </TBButton>
      )}
    </div>
  );
}
