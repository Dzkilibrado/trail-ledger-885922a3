import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { getPublicHealthReport } from "@/lib/health-reports.functions";
import { ReportSnapshotView } from "@/components/health/reports/ReportSnapshotView";
import { TBErrorState, TBLoadingState } from "@/design-system";
import { trackHealth } from "@/lib/health-reports/telemetry";
import { REPORT_STATUS_LABEL, type HealthReportSnapshot, type ReportStatus } from "@/lib/health-reports/types";

export const Route = createFileRoute("/l/$token")({
  head: () => ({
    meta: [
      { title: "Laudo Inteligente — TrailBook" },
      { name: "description", content: "Laudo compartilhado da motocicleta, emitido e verificado pelo TrailBook." },
      { property: "og:title", content: "Laudo Inteligente — TrailBook" },
      { property: "og:description", content: "Diagnóstico da moto com validade, ressalvas e verificação de integridade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicReportPage,
});

function PublicReportPage() {
  const { token } = Route.useParams();

  const q = useQuery({
    queryKey: ["public-health-report", token],
    queryFn: () => getPublicHealthReport({ data: { token } }),
  });

  const result = q.data;
  useEffect(() => {
    if (!result) return;
    if (result.ok) trackHealth("pagina_publica_acessada", { code: result.code });
    else if (result.reason === "expired") trackHealth("link_expirado");
    else if (result.reason === "revoked") trackHealth("link_revogado");
  }, [result]);

  if (q.isLoading) return <div className="mx-auto max-w-2xl p-4"><TBLoadingState label="Abrindo o laudo…" /></div>;
  if (q.error) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <TBErrorState title="Não foi possível abrir o laudo" onRetry={() => q.refetch()} />
      </div>
    );
  }

  const data = q.data;
  if (!data?.ok) {
    const reason =
      data?.reason === "expired"
        ? "Este link expirou."
        : data?.reason === "revoked"
          ? "Este link foi revogado pelo proprietário."
          : "Este link não é válido.";
    return (
      <div className="mx-auto max-w-2xl p-4">
        <TBErrorState title="Laudo indisponível" description={reason} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4 pb-16">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden /> TrailBook
        </div>
        <h1 className="text-2xl font-black leading-tight">Laudo Inteligente {data.code}</h1>
        <p className="text-sm text-muted-foreground">
          {REPORT_STATUS_LABEL[data.status as ReportStatus] ?? data.status}
          {data.outdatedReason ? ` · ${data.outdatedReason}` : ""}
        </p>
      </header>

      <ReportSnapshotView
        snapshot={data.snapshot as Partial<HealthReportSnapshot>}
        sections={data.allowedSections}
        code={data.code}
        sha256={data.sha256}
        statusLabel={REPORT_STATUS_LABEL[data.status as ReportStatus]}
      />
    </div>
  );
}