import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBCard, TBEmptyState, TBLoadingState, TBSelect } from "@/design-system";
import { CompareView } from "@/components/health/reports/CompareView";
import { compareReports } from "@/lib/health-reports/compare";
import type { HealthReportSnapshot } from "@/lib/health-reports/types";
import { formatDate } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/checkups/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar laudos — TrailBook" },
      {
        name: "description",
        content: "Compare dois laudos e veja a evolução da saúde da sua moto.",
      },
      { property: "og:title", content: "Comparar laudos — TrailBook" },
      {
        property: "og:description",
        content: "Evolução entre dois check-ups da mesma motocicleta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { id } = Route.useParams();

  const q = useQuery({
    queryKey: ["health-reports-snapshots", id],
    queryFn: async () =>
      (
        await supabase
          .from("health_reports")
          .select("id, code, issued_at, health_report_snapshots(payload)")
          .eq("motorcycle_id", id)
          .order("issued_at", { ascending: false })
      ).data ?? [],
  });

  const list = q.data ?? [];
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  const options = list.map((r) => ({
    value: r.code ?? r.id,
    label: `${r.code} — ${formatDate(r.issued_at)}`,
  }));
  const older = list.find((r) => (r.code ?? r.id) === (a || options[1]?.value));
  const newer = list.find((r) => (r.code ?? r.id) === (b || options[0]?.value));

  const comparison = useMemo(() => {
    const sa = (older as unknown as { health_report_snapshots?: { payload: unknown } })
      ?.health_report_snapshots?.payload as HealthReportSnapshot | undefined;
    const sb = (newer as unknown as { health_report_snapshots?: { payload: unknown } })
      ?.health_report_snapshots?.payload as HealthReportSnapshot | undefined;
    if (!sa || !sb || older?.id === newer?.id) return null;
    return compareReports(
      { code: older!.code ?? "", snapshot: sa },
      { code: newer!.code ?? "", snapshot: sb },
    );
  }, [older, newer]);

  if (q.isLoading) return <TBLoadingState label="Carregando laudos…" />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-24">
      <PageHeader
        title="Comparar laudos"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: "Check-ups", to: `/motorcycles/${id}/checkups` },
          { label: "Comparar" },
        ]}
        description="Veja o que melhorou, o que piorou e o que continua pendente entre dois check-ups."
      />

      {list.length < 2 ? (
        <TBEmptyState
          title="Ainda não há laudos suficientes"
          description="É preciso ter pelo menos dois laudos emitidos para comparar a evolução da moto."
        />
      ) : (
        <>
          <TBCard className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Laudo anterior</span>
              <TBSelect value={a || options[1]?.value} onValueChange={setA} options={options} />
            </div>
            <div className="min-w-0 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Laudo mais recente
              </span>
              <TBSelect value={b || options[0]?.value} onValueChange={setB} options={options} />
            </div>
          </TBCard>
          {comparison ? (
            <CompareView comparison={comparison} />
          ) : (
            <TBEmptyState
              title="Selecione dois laudos diferentes"
              description="Escolha períodos distintos para comparar."
            />
          )}
        </>
      )}
    </div>
  );
}
