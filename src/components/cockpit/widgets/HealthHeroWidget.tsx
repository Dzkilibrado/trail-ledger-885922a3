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
      className="surface-elevated rounded-3xl px-6 py-8 sm:px-10 sm:py-12"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div className={`flex items-center gap-3 text-sm uppercase tracking-widest ${accent}`}>
          <Icon className="h-4 w-4" aria-hidden />
          <span>{health.gradeLabel}</span>
        </div>

        <div className="font-display text-6xl font-bold sm:text-7xl">
          {health.score}
          <span className="ml-1 text-2xl text-muted-foreground sm:text-3xl">%</span>
        </div>

        <div className="max-w-sm space-y-1">
          <div className="text-sm text-muted-foreground">{health.headline}</div>
          {top && (
            <>
              <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
                Item mais crítico
              </div>
              <div className="text-lg font-semibold">{top.name}</div>
              <div className={`text-sm ${top.tone === "critical" ? "text-destructive" : "text-amber-400"}`}>
                {top.statusLabel}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}