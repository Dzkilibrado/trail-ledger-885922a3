import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, GitCompareArrows, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBButton, TBCard, TBEmptyState, TBLoadingState, TBStatusPill } from "@/design-system";
import { REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/health-reports/types";
import { effectiveValidity } from "@/lib/health-reports/validity";
import type { HealthStatus } from "@/lib/til/status";
import { formatDate } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/checkups/")({
  head: () => ({
    meta: [
      { title: "Central de Check-ups — TrailBook" },
      { name: "description", content: "Histórico de check-ups e laudos emitidos da sua motocicleta." },
      { property: "og:title", content: "Central de Check-ups — TrailBook" },
      { property: "og:description", content: "Acompanhe a evolução da saúde da sua moto ao longo do tempo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckupsHub,
});

function CheckupsHub() {
  const { id } = Route.useParams();

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("id", id).single()).data,
  });

  const reports = useQuery({
    queryKey: ["health-reports", id],
    queryFn: async () =>
      (
        await supabase
          .from("health_reports")
          .select(
            "id, code, status, issued_at, overall_status, conservation_index, valid_until, valid_hours_limit, valid_km_limit, outdated_reason, has_reservations",
          )
          .eq("motorcycle_id", id)
          .order("issued_at", { ascending: false })
      ).data ?? [],
  });

  if (reports.isLoading) return <TBLoadingState label="Carregando seus check-ups…" />;
  const list = reports.data ?? [];
  const current = { hours: Number(moto.data?.hours_total ?? 0), km: Number(moto.data?.km_total ?? 0) };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-24">
      <PageHeader
        title="Check-ups e Laudos"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: moto.data?.nickname || moto.data?.model || "Moto", to: `/motorcycles/${id}` },
          { label: "Check-ups" },
        ]}
        description="Cada check-up gera um laudo com a fotografia da sua moto naquele momento."
      />

      <div className="flex flex-wrap gap-2">
        <TBButton asChild>
          <Link to="/motorcycles/$id/checkups/novo" params={{ id }}>
            <Stethoscope className="h-4 w-4" aria-hidden /> Fazer Check-up
          </Link>
        </TBButton>
        {list.length >= 2 && (
          <TBButton asChild variant="outline">
            <Link to="/motorcycles/$id/checkups/comparar" params={{ id }}>
              <GitCompareArrows className="h-4 w-4" aria-hidden /> Comparar laudos
            </Link>
          </TBButton>
        )}
      </div>

      {list.length === 0 ? (
        <TBEmptyState
          title="Nenhum check-up realizado"
          description="O Check-up organiza tudo o que já foi registrado e gera um laudo que você pode compartilhar com compradores e oficinas."
          icon={<Stethoscope className="h-5 w-5" aria-hidden />}
        />
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const eff = effectiveValidity(r, current);
            return (
              <Link
                key={r.id}
                to="/motorcycles/$id/checkups/$code"
                params={{ id, code: r.code ?? "" }}
                className="block"
              >
                <TBCard interactive className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TBStatusPill status={(r.overall_status as HealthStatus) ?? "unknown"} size="sm" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {REPORT_STATUS_LABEL[(eff.status as ReportStatus) ?? "valid"]}
                      </span>
                    </div>
                    <div className="truncate text-sm font-bold">{r.code}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(r.issued_at)} · {eff.label}
                    </div>
                    {r.has_reservations && (
                      <div className="text-xs text-muted-foreground">Emitido com ressalvas</div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
                </TBCard>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}