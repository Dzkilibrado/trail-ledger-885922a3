import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, ClipboardCheck } from "lucide-react";
import { TBStatusPill } from "@/design-system/primitives/TBStatusPill";
import { HEALTH_STATUS_DOT } from "@/lib/til/status";
import type { ComponentDiagnosis, ComponentTrend } from "@/lib/til/diagnosis";

const TREND_ICON: Record<ComponentTrend, React.ComponentType<{ className?: string }>> = {
  improving: ArrowUpRight,
  stable: ArrowRight,
  worsening: ArrowDownRight,
  unknown: Activity,
};

const TREND_COLOR: Record<ComponentTrend, string> = {
  improving: "text-emerald-500",
  stable: "text-muted-foreground",
  worsening: "text-amber-400",
  unknown: "text-muted-foreground",
};

/**
 * Diagnóstico Inteligente de um componente.
 * Nunca mostra nota: mostra status, motivos observados e conclusão.
 */
export function DiagnosisCard({ diagnosis }: { diagnosis: ComponentDiagnosis }) {
  const TrendIcon = TREND_ICON[diagnosis.trend];
  return (
    <section
      aria-label="Diagnóstico do componente"
      className="rounded-2xl border border-border bg-card p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
          Diagnóstico
        </div>
        <TBStatusPill status={diagnosis.status} label={diagnosis.statusLabel} size="sm" />
      </header>

      {diagnosis.lifeRemainingPct != null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Vida útil estimada</span>
            <span className="font-medium">{diagnosis.lifeRemainingLabel}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${HEALTH_STATUS_DOT[diagnosis.status]}`}
              style={{ width: `${Math.max(3, diagnosis.lifeRemainingPct)}%` }}
            />
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-1.5">
        {diagnosis.reasons.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            <span className="min-w-0">{r}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-sm font-medium leading-snug">
        {diagnosis.conclusion}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Próxima manutenção</dt>
          <dd className="mt-0.5 font-medium">{diagnosis.nextMaintenanceLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tendência</dt>
          <dd className={`mt-0.5 flex items-center gap-1 font-medium ${TREND_COLOR[diagnosis.trend]}`}>
            <TrendIcon className="h-3.5 w-3.5" aria-hidden />
            {diagnosis.trendLabel}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última manutenção</dt>
          <dd className="mt-0.5 font-medium">{diagnosis.lastMaintenanceLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última inspeção</dt>
          <dd className="mt-0.5 font-medium">{diagnosis.lastInspectionLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
