import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, ClipboardCheck, TriangleAlert } from "lucide-react";
import { TBStatusPill } from "@/design-system/primitives/TBStatusPill";
import { HEALTH_STATUS_DOT } from "@/lib/til/status";
import type { ComponentDiagnosis, ComponentTrend } from "@/lib/til/diagnosis";
import { ConfidenceBadge } from "./ConfidenceBadge";

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
 * Todo texto vem da TIL (catálogo central) — a tela nunca escreve diagnóstico.
 * Status sempre acompanhado de ícone e texto (nunca só cor).
 */
export function DiagnosisCard({ diagnosis }: { diagnosis: ComponentDiagnosis }) {
  const TrendIcon = TREND_ICON[diagnosis.trend];
  return (
    <div className="space-y-3">
      <section aria-label="Diagnóstico do componente" className="rounded-2xl border border-border bg-card p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
            Diagnóstico
          </div>
          <TBStatusPill status={diagnosis.status} label={diagnosis.statusTitle} size="sm" />
        </header>

        {diagnosis.hasConflict && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Detectamos informações conflitantes nos registros. Confira os dados informados — não assumimos um cenário seguro nesta situação.</span>
          </p>
        )}

        {diagnosis.lifeRemainingPct != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Vida útil estimada</span>
              <span className="font-medium">{diagnosis.lifeRemainingLabel}</span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Vida útil estimada: ${diagnosis.lifeRemainingLabel}`}
            >
              <div
                className={`h-full transition-all ${HEALTH_STATUS_DOT[diagnosis.status]}`}
                style={{ width: `${Math.max(3, diagnosis.lifeRemainingPct)}%` }}
              />
            </div>
          </div>
        )}

        <h4 className="mt-4 text-sm font-semibold">{diagnosis.whyTitle}</h4>
        <ul className="mt-1.5 space-y-1.5">
          {diagnosis.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
              <span className="min-w-0">{r}</span>
            </li>
          ))}
        </ul>

        <h4 className="mt-4 text-sm font-semibold">O que isso significa?</h4>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{diagnosis.meaning}</p>

        <h4 className="mt-4 text-sm font-semibold">O que fazer?</h4>
        <p className="mt-1 rounded-xl bg-muted/60 px-3 py-2 text-sm font-medium leading-snug">
          {diagnosis.conclusion}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Próxima manutenção</dt>
            <dd className="mt-0.5 font-medium">{diagnosis.nextMaintenanceLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prazo estimado</dt>
            <dd className="mt-0.5 font-medium">{diagnosis.dueEstimateLabel}</dd>
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

      <ConfidenceBadge confidence={diagnosis.confidence} />
    </div>
  );
}
