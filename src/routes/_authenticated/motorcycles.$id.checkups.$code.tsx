import { shareUrl } from "@/lib/external-links";
import { useModule } from "@/hooks/useModules";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBButton, TBErrorState, TBLoadingState } from "@/design-system";
import { ReportSnapshotView } from "@/components/health/reports/ReportSnapshotView";
import { SharePanel } from "@/components/health/reports/SharePanel";
import { FiscalShareDialog } from "@/components/health/reports/FiscalShareDialog";
import { buildReportPdf, reportFileName } from "@/lib/health-reports/pdf";
import {
  REPORT_PURPOSE_LABEL,
  REPORT_PURPOSE_DEFAULT_TITLE,
  REPORT_STATUS_LABEL,
  type HealthReportSnapshot,
  type ReportPurpose,
  type ReportStatus,
} from "@/lib/health-reports/types";
import { effectiveValidity } from "@/lib/health-reports/validity";
import { saveFile } from "@/lib/save-file";
import { trackHealth } from "@/lib/health-reports/telemetry";

const PURPOSE_BADGE_CLASS: Record<ReportPurpose, string> = {
  comercial: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  oficina: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  pessoal: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

export const Route = createFileRoute("/_authenticated/motorcycles/$id/checkups/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Laudo ${params.code} — TrailBook` },
      {
        name: "description",
        content: `Laudo Inteligente ${params.code} com diagnóstico completo da motocicleta.`,
      },
      { property: "og:title", content: `Laudo ${params.code} — TrailBook` },
      {
        property: "og:description",
        content: "Diagnóstico, plano de ação e histórico da moto no momento da emissão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id, code } = Route.useParams();
  const [saving, setSaving] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const fiscalModule = useModule("fiscalizacao");
  const fiscalEnabled = fiscalModule.status === "active" || fiscalModule.status === "beta";
  const fiscalBeta = fiscalModule.status === "beta";
  const [reopenPdf, setReopenPdf] = useState<(() => void | Promise<void>) | null>(null);
  const lastRunRef = useRef(0);

  const q = useQuery({
    queryKey: ["health-report", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_reports")
        .select("*, health_report_snapshots(payload, sha256)")
        .eq("code", code)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () =>
      (await supabase.from("motorcycles").select("hours_total, km_total").eq("id", id).single())
        .data,
  });

  if (q.isLoading) return <TBLoadingState label="Abrindo o laudo…" />;
  if (q.error || !q.data)
    return <TBErrorState title="Laudo não encontrado" onRetry={() => q.refetch()} />;

  const report = q.data;
  const snapRel = (
    report as unknown as { health_report_snapshots: { payload: unknown; sha256: string } | null }
  ).health_report_snapshots;
  const snapshot = snapRel?.payload as HealthReportSnapshot | undefined;
  const eff = effectiveValidity(report, {
    hours: Number(moto.data?.hours_total ?? 0),
    km: Number(moto.data?.km_total ?? 0),
  });

  const purpose: ReportPurpose = snapshot?.purpose ?? "pessoal";
  const reportTitle = snapshot?.reportTitle
    ?? REPORT_PURPOSE_DEFAULT_TITLE[purpose];

  const downloadPdf = async () => {
    if (!snapshot || saving) return;
    // Evita que toques repetidos gerem vários arquivos iguais.
    if (Date.now() - lastRunRef.current < 2500) return;
    lastRunRef.current = Date.now();
    setSaving(true);
    try {
      trackHealth("pdf_iniciado", { code: report.code ?? code });

      // Busca share de laudo (rota /l/) e share de documentos (rota /d/) em paralelo
      const [shareResult, docShareResult] = await Promise.all([
        supabase
          .from("health_report_shares")
          .select("public_token")
          .eq("report_id", report.id)
          .is("revoked_at", null)
          .limit(1),
        supabase
          .from("motorcycle_document_shares" as never)
          .select("token")
          .eq("report_id", report.id)
          .is("revoked_at", null)
          .limit(1),
      ]);

      const share = shareResult.data?.[0];
      const docShare = (docShareResult.data as Array<{ token: string }> | null)?.[0];

      const publicUrl = share ? shareUrl(`/l/${share.public_token}`) : null;
      const docsQrUrl = docShare ? shareUrl(`/d/${docShare.token}`) : null;

      const qrDataUrl = publicUrl
        ? await QRCode.toDataURL(publicUrl, { width: 320, margin: 1 })
        : null;
      const blob = await buildReportPdf({
        snapshot,
        code: report.code ?? code,
        sha256: report.snapshot_sha256,
        statusLabel: REPORT_STATUS_LABEL[eff.status as ReportStatus] ?? eff.label,
        qrDataUrl,
        publicUrl,
        docsQrUrl,
      });
      const res = await saveFile({
        blob,
        fileName: reportFileName(report.code ?? code, report.issued_at),
        mime: "application/pdf",
        shareTitle: "Laudo Inteligente TrailBook",
      });
      setReopenPdf(() => res.reopen ?? null);
      if (res.outcome === "error") {
        // Fallback seguro: abre o PDF para o usuário salvar pelo visualizador do aparelho.
        const fallbackUrl = URL.createObjectURL(blob);
        window.open(fallbackUrl, "_blank", "noopener");
        toast.warning(
          "Abrimos o PDF em uma nova aba. Use o menu do visualizador para salvar ou compartilhar.",
        );
        trackHealth("pdf_erro", { code: report.code ?? code, fallback: "nova-aba" });
      } else if (res.outcome === "saved") {
        toast.success("PDF salvo no local que você escolheu.");
        trackHealth("pdf_concluido", { code: report.code ?? code, outcome: res.outcome });
      } else if (res.outcome === "shared") {
        toast.success("PDF pronto. Escolha onde salvar ou qual app usar para abrir.");
        trackHealth("pdf_concluido", { code: report.code ?? code, outcome: res.outcome });
      } else if (res.outcome === "downloaded") {
        toast.success(
          "PDF baixado para a pasta Downloads do seu aparelho. Toque em “Abrir PDF” para visualizar.",
          {
            duration: 6000,
          },
        );
        trackHealth("pdf_concluido", { code: report.code ?? code, outcome: res.outcome });
      } else if (res.outcome === "cancelled") {
        toast.info("O PDF já está pronto no aparelho. Toque em “Abrir PDF” quando quiser.");
      }
    } catch {
      toast.error(
        `Não foi possível gerar o PDF. Tente novamente. Se o problema continuar, informe o código ${report.code ?? code} ao suporte.`,
      );
      trackHealth("pdf_erro", { code: report.code ?? code });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-24">
      <PageHeader
        title={reportTitle}
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: "Check-ups", to: `/motorcycles/${id}/checkups` },
          { label: report.code ?? "Laudo" },
        ]}
        description={`${REPORT_STATUS_LABEL[eff.status as ReportStatus] ?? ""} · ${eff.label}`}
      />

      {/* Badge de finalidade + código */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PURPOSE_BADGE_CLASS[purpose]}`}>
          {REPORT_PURPOSE_LABEL[purpose]}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{report.code}</span>
      </div>

      {/* Ações principais */}
      <div className="flex flex-wrap gap-2">
        <TBButton onClick={downloadPdf} disabled={saving || !snapshot} aria-busy={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          {saving ? "Preparando PDF…" : "Salvar em PDF"}
        </TBButton>
        {reopenPdf && !saving && (
          <TBButton variant="outline" onClick={() => reopenPdf()}>
            Abrir PDF
          </TBButton>
        )}
      </div>

      {saving && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Preparando seu laudo…
        </p>
      )}

      <SharePanel reportId={report.id} canManage />

      {/* Fiscalização — card dedicado, visualmente distinto */}
      {fiscalEnabled && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
              <span>Acesso para Fiscalização</span>
              {fiscalBeta && (
                <span className="rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wide">β</span>
              )}
            </div>
            <TBButton variant="outline" size="sm" onClick={() => setFiscalOpen(true)}>
              Gerar acesso
            </TBButton>
          </div>
          <p className="mt-1 text-xs text-muted-foreground pl-6">
            Acesso temporário para agente fiscal — expira automaticamente.
          </p>
        </div>
      )}

      <FiscalShareDialog
        reportId={report.id}
        reportStatus={report.status as string}
        reportCode={report.code ?? ""}
        open={fiscalOpen}
        onClose={() => setFiscalOpen(false)}
      />

      {snapshot ? (
        <ReportSnapshotView
          snapshot={snapshot}
          purpose={purpose}
          code={report.code ?? code}
          sha256={report.snapshot_sha256}
          statusLabel={REPORT_STATUS_LABEL[eff.status as ReportStatus]}
        />
      ) : (
        <TBErrorState
          title="Conteúdo do laudo indisponível"
          description="Tente novamente em instantes."
        />
      )}
    </div>
  );
}
