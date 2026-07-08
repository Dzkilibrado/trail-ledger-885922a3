import type { CockpitSnapshot } from "@/lib/til";
import { Heart, AlertTriangle, Clock } from "lucide-react";

const GRADE_ACCENT: Record<CockpitSnapshot["health"]["grade"], string> = {
  excellent: "text-emerald-400",
  good: "text-primary",
  attention: "text-amber-400",
  critical: "text-destructive",
};

export function HealthHeroWidget({ snapshot }: { snapshot: CockpitSnapshot }) {
  const { health } = snapshot;
  const Icon = health.grade === "critical" ? AlertTriangle : health.grade === "attention" ? Clock : Heart;
  const accent = GRADE_ACCENT[health.grade];
  const top = health.topAttention;

  return (
    <section
      aria-label="Estado da moto"
      className="surface-elevated grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted ${accent}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Saúde</span>
          <span className={`text-xs uppercase tracking-wider ${accent}`}>{health.gradeLabel}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {top ? `${top.name} · ${top.statusLabel}` : health.headline}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-display text-2xl font-bold leading-none sm:text-3xl">
          {health.score}
          <span className="ml-0.5 text-sm text-muted-foreground">%</span>
        </div>
      </div>
    </section>
  );
}