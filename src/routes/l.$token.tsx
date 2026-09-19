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

  const isFiscal = (data as any).preset === "fiscal";

  if (isFiscal) {
    return <FiscalPublicView data={data} />;
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
// ── Tela pública de Fiscalização ─────────────────────────────
function FiscalPublicView({ data }: { data: any }) {
  const snap = data.snapshot as Partial<HealthReportSnapshot> | undefined;
  const moto = snap?.motorcycle;
  const overall = snap?.overall;
  const rideAnswer = snap?.rideAnswer;

  const statusLabel =
    rideAnswer?.status === "ok"      ? "Saudavel"      :
    rideAnswer?.status === "attention"? "Atencao"       :
    rideAnswer?.status === "action"  ? "Necessita acao" :
    "Sem dados suficientes";

  const expiresAt = data.valid_until
    ? new Date(data.valid_until).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header fiscal */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">TrailBook</p>
          <p className="text-sm font-bold leading-none">Acesso temporario para fiscalizacao</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">

        {/* Moto */}
        {moto && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Motocicleta</p>
            <p className="text-lg font-bold">{moto.brand} {moto.model}</p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              {moto.yearModel && <span>{moto.yearModel}</span>}
              {moto.plate && <span>Placa: {moto.plate}</span>}
              {moto.chassisMasked && <span>Chassi: {moto.chassisMasked}</span>}
            </div>
          </section>
        )}

        {/* Laudo */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Laudo</p>
          <p className="font-mono text-sm font-semibold">{data.code}</p>
          <p className="text-sm text-muted-foreground">
            Emitido em {data.issued_at ? new Date(data.issued_at).toLocaleDateString("pt-BR") : "—"}
          </p>
          <p className="text-sm">
            Status: <span className="font-semibold">{REPORT_STATUS_LABEL[data.status as ReportStatus] ?? data.status}</span>
          </p>
        </section>

        {/* Situacao geral */}
        {rideAnswer && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Situacao geral</p>
            <p className="text-base font-bold">{statusLabel}</p>
            {rideAnswer.message && (
              <p className="text-sm text-muted-foreground">{rideAnswer.message}</p>
            )}
          </section>
        )}
      </main>

      {/* Rodape */}
      <footer className="border-t border-border px-4 py-3 text-center space-y-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Este acesso foi compartilhado voluntariamente pelo proprietario e possui validade temporaria.
          Nao substitui documento oficial governamental.
        </p>
        {expiresAt && (
          <p className="text-xs font-semibold text-muted-foreground">
            Valido ate: {expiresAt}
          </p>
        )}
      </footer>
    </div>
  );
}
