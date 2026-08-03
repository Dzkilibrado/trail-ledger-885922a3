import { shareUrl } from "@/lib/external-links";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBButton, TBErrorState, TBLoadingState } from "@/design-system";
import { ReportSnapshotView } from "@/components/health/reports/ReportSnapshotView";
import { SharePanel } from "@/components/health/reports/SharePanel";
import { buildReportPdf, reportFileName } from "@/lib/health-reports/pdf";
import { REPORT_STATUS_LABEL, type HealthReportSnapshot, type ReportStatus } from "@/lib/health-reports/types";
import { effectiveValidity } from "@/lib/health-reports/validity";
import { saveFile } from "@/lib/save-file";
import { trackHealth } from "@/lib/health-reports/telemetry";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/checkups/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Laudo ${params.code} — TrailBook` },
      { name: "description", content: `Laudo Inteligente ${params.code} com diagnóstico completo da motocicleta.` },
      { property: "og:title", content: `Laudo ${params.code} — TrailBook` },
      { property: "og:description", content: "Diagnóstico, plano de ação e histórico da moto no momento da emissão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id, code } = Route.useParams();
  const [saving, setSaving] = useState(false);
  const [lastBlobUrl, setLastBlobUrl] = useState<string | null>(null);
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
    queryFn: async () => (await supabase.from("motorcycles").select("hours_total, km_total").eq("id", id).single()).data,
  });

  if (q.isLoading) return <TBLoadingState label="Abrindo o laudo…" />;
  if (q.error || !q.data) return <TBErrorState title="Laudo não encontrado" onRetry={() => q.refetch()} />;

  const report = q.data;
  const snapRel = (report as unknown as { health_report_snapshots: { payload: unknown; sha256: string } | null })
    .health_report_snapshots;
  const snapshot = snapRel?.payload as HealthReportSnapshot | undefined;
  const eff = effectiveValidity(report, {
    hours: Number(moto.data?.hours_total ?? 0),
    km: Number(moto.data?.km_total ?? 0),
  });

  const downloadPdf = async () => {
    if (!snapshot || saving) return;
    // Evita que toques repetidos gerem vários arquivos iguais.
    if (Date.now() - lastRunRef.current < 2500) return;
    lastRunRef.current = Date.now();
    setSaving(true);
    try {
      trackHealth("pdf_iniciado", { code: report.code ?? code });
      const share = (
        await supabase
          .from("health_report_shares")
          .select("public_token")
          .eq("report_id", report.id)
          .is("revoked_at", null)
          .limit(1)
      ).data?.[0];
      const publicUrl = share ? shareUrl(`/l/${share.public_token}`) : null;
      const qrDataUrl = publicUrl ? await QRCode.toDataURL(publicUrl, { width: 320, margin: 1 }) : null;
      const blob = await buildReportPdf({
        snapshot,
        code: report.code ?? code,
        sha256: report.snapshot_sha256,
        statusLabel: REPORT_STATUS_LABEL[eff.status as ReportStatus] ?? eff.label,
        qrDataUrl,
        publicUrl,
      });
      const res = await saveFile({
        blob,
        fileName: reportFileName(report.code ?? code, report.issued_at),
        mime: "application/pdf",
        shareTitle: "Laudo Inteligente TrailBook",
      });
      if (res.outcome === "error") {
        // Fallback seguro: abre o PDF para o usuário salvar pelo visualizador do aparelho.
        const url = URL.createObjectURL(blob);
        setLastBlobUrl(url);
        window.open(url, "_blank", "noopener");
        toast.warning("Abrimos o PDF em uma nova aba. Use o menu do visualizador para salvar ou compartilhar.");
        trackHealth("pdf_erro", { code: report.code ?? code, fallback: "nova-aba" });
      } else if (res.outcome !== "cancelled") {
        toast.success("PDF gerado com sucesso.");
        trackHealth("pdf_concluido", { code: report.code ?? code, outcome: res.outcome });
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
        title={`Laudo ${report.code}`}
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: "Check-ups", to: `/motorcycles/${id}/checkups` },
          { label: report.code ?? "Laudo" },
        ]}
        description={`${REPORT_STATUS_LABEL[eff.status as ReportStatus] ?? ""} · ${eff.label}`}
      />

      <div className="flex flex-wrap gap-2">
        <TBButton onClick={downloadPdf} disabled={saving || !snapshot} aria-busy={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          {saving ? "Preparando seu Laudo TrailBook…" : "Salvar em PDF"}
        </TBButton>
        {lastBlobUrl && !saving && (
          <TBButton variant="outline" asChild>
            <a href={lastBlobUrl} target="_blank" rel="noopener noreferrer">
              Abrir PDF novamente
            </a>
          </TBButton>
        )}
      </div>
      {saving && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Preparando seu Laudo TrailBook…
        </p>
      )}

      <SharePanel reportId={report.id} canManage />

      {snapshot ? (
        <ReportSnapshotView
          snapshot={snapshot}
          code={report.code ?? code}
          sha256={report.snapshot_sha256}
          statusLabel={REPORT_STATUS_LABEL[eff.status as ReportStatus]}
        />
      ) : (
        <TBErrorState title="Conteúdo do laudo indisponível" description="Tente novamente em instantes." />
      )}
    </div>
  );
}