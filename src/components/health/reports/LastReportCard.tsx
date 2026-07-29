import { Link } from "@tanstack/react-router";
import { FileCheck2, Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TBButton, TBCard, TBStatusPill } from "@/design-system";
import { REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/health-reports/types";
import type { HealthStatus } from "@/lib/til/status";
import { formatDate } from "@/lib/trailbook";

/** Cartão de integração: último laudo emitido + atalho para o Check-up. */
export function LastReportCard({ motoId }: { motoId: string }) {
  const q = useQuery({
    queryKey: ["health-report-last", motoId],
    queryFn: async () =>
      (
        await supabase
          .from("health_reports")
          .select("id, code, status, issued_at, overall_status, valid_until")
          .eq("motorcycle_id", motoId)
          .order("issued_at", { ascending: false })
          .limit(1)
      ).data?.[0] ?? null,
  });

  const r = q.data;

  return (
    <TBCard className="space-y-3">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-black">Check-up e Laudo</h3>
      </div>
      {r ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <TBStatusPill status={(r.overall_status as HealthStatus) ?? "unknown"} size="sm" />
            <span className="text-xs text-muted-foreground">
              {REPORT_STATUS_LABEL[r.status as ReportStatus] ?? r.status} · {formatDate(r.issued_at)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Último laudo emitido: <strong className="text-foreground">{r.code}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <TBButton asChild size="sm" variant="outline">
              <Link to="/motorcycles/$id/checkups/$code" params={{ id: motoId, code: r.code ?? "" }}>
                <FileCheck2 className="h-4 w-4" aria-hidden /> Ver laudo
              </Link>
            </TBButton>
            <TBButton asChild size="sm">
              <Link to="/motorcycles/$id/checkups" params={{ id: motoId }}>
                Central de Check-ups
              </Link>
            </TBButton>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você ainda não emitiu nenhum laudo desta moto. O Check-up organiza tudo o que já foi registrado e gera um
            documento que você pode compartilhar.
          </p>
          <TBButton asChild size="sm">
            <Link to="/motorcycles/$id/checkups/novo" params={{ id: motoId }}>
              Fazer Check-up
            </Link>
          </TBButton>
        </div>
      )}
    </TBCard>
  );
}