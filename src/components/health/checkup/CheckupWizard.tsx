import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TBButton, TBCard, TBErrorState, TBLoadingState, TBStatusPill } from "@/design-system";
import { useHealthSnapshot } from "@/hooks/useHealthSnapshot";
import { checkEmission } from "@/lib/health-reports/gating";
import { computeValidity } from "@/lib/health-reports/validity";
import { buildReportSnapshot } from "@/lib/health-reports/snapshot";
import type { HealthReportSnapshot } from "@/lib/health-reports/types";
import { issueHealthReport, startCheckRun, updateCheckRun } from "@/lib/health-reports.functions";
import { ReportSnapshotView } from "@/components/health/reports/ReportSnapshotView";
import { trackHealth } from "@/lib/health-reports/telemetry";
import { cn } from "@/lib/utils";

const STEPS = ["Identificação", "Revisão", "Análise", "Condições", "Prévia", "Emissão"] as const;

export function CheckupWizard({ motoId, uid }: { motoId: string; uid: string | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const health = useHealthSnapshot(motoId, uid);
  const start = useServerFn(startCheckRun);
  const update = useServerFn(updateCheckRun);
  const issue = useServerFn(issueHealthReport);

  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [issuedAtRef] = useState(() => new Date().toISOString());

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
    return buildReportSnapshot({
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
              <TBButton onClick={() => setStep(4)}>Ver prévia do laudo</TBButton>
            </TBCard>
          )}
        </div>
      )}

      {step === 4 && previewSnapshot && (
        <div className="space-y-4">
          <TBCard className="space-y-1">
            <h2 className="text-base font-black">Prévia do laudo</h2>
            <p className="text-sm text-muted-foreground">
              Este é exatamente o conteúdo que será registrado. Depois de emitido, o laudo não pode
              ser alterado.
            </p>
          </TBCard>
          <ReportSnapshotView snapshot={previewSnapshot} />
          <TBButton className="w-full" onClick={() => setStep(5)}>
            Continuar para emissão
          </TBButton>
        </div>
      )}

      {step === 5 && previewSnapshot && validity && (
        <TBCard className="space-y-4">
          <h2 className="text-base font-black">Confirmação de emissão</h2>
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
