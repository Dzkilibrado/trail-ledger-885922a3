import { TBCard, TBStatusPill } from "@/design-system";
import { CHANGE_LABEL, type ReportComparison } from "@/lib/health-reports/compare";
import type { HealthStatus } from "@/lib/til/status";
import { formatDate } from "@/lib/trailbook";

const asStatus = (v: string | null): HealthStatus =>
  v && ["ok", "attention", "action", "unknown"].includes(v) ? (v as HealthStatus) : "unknown";

function List({ title, items }: { title: string; items: ReportComparison["improved"] }) {
  if (items.length === 0) return null;
  return (
    <TBCard className="space-y-2">
      <div className="text-sm font-bold">{title}</div>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{c.name}</span>
            <TBStatusPill status={asStatus(c.from)} label={c.fromLabel} size="sm" />
            <span aria-hidden>→</span>
            <TBStatusPill status={asStatus(c.to)} label={c.toLabel} size="sm" />
          </li>
        ))}
      </ul>
    </TBCard>
  );
}

/** Comparação narrativa entre dois laudos — sempre a partir dos snapshots. */
export function CompareView({ comparison }: { comparison: ReportComparison }) {
  const c = comparison;
  return (
    <div className="space-y-4">
      <TBCard className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {formatDate(c.from.issuedAt)} ({c.from.code}) → {formatDate(c.to.issuedAt)} ({c.to.code}) ·{" "}
          {c.periodDays} dias
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TBStatusPill status={asStatus(c.from.status)} label={c.from.statusLabel} size="sm" />
          <span aria-hidden>→</span>
          <TBStatusPill status={asStatus(c.to.status)} label={c.to.statusLabel} size="sm" />
          <span className="text-xs font-semibold text-muted-foreground">{CHANGE_LABEL[c.overallChange]}</span>
        </div>
        <p className="text-sm">{c.overallSummary}</p>
      </TBCard>

      <TBCard className="space-y-1">
        <div className="text-sm font-bold">Como a avaliação evoluiu</div>
        <div className="flex flex-wrap items-center gap-2">
          <EvaluationPill state={stateFromScore(c.from.conservation)} size="sm" />
          <span aria-hidden>→</span>
          <EvaluationPill state={stateFromScore(c.to.conservation)} size="sm" />
        </div>
        <p className="text-sm text-muted-foreground">{c.indices.conservationNarrative}</p>
        <p className="text-xs text-muted-foreground">
          Confiabilidade da avaliação: {c.indices.confidenceFrom} → {c.indices.confidenceTo}
        </p>
      </TBCard>

      <List title="Resolvidos" items={c.resolved} />
      <List title="Melhoraram" items={c.improved} />
      <List title="Pioraram" items={c.worsened} />
      <List title="Novos alertas" items={c.newAlerts} />

      <TBCard className="space-y-2">
        <div className="text-sm font-bold">Recomendações</div>
        {c.recommendations.resolved.length > 0 && (
          <p className="text-sm text-muted-foreground">Concluídas: {c.recommendations.resolved.join("; ")}</p>
        )}
        {c.recommendations.stillPending.length > 0 && (
          <p className="text-sm text-muted-foreground">Ainda pendentes: {c.recommendations.stillPending.join("; ")}</p>
        )}
        {c.recommendations.newOnes.length > 0 && (
          <p className="text-sm text-muted-foreground">Novas: {c.recommendations.newOnes.join("; ")}</p>
        )}
      </TBCard>
    </div>
  );
}