import type { CockpitSnapshot } from "@/lib/til";
import { Heart, AlertTriangle, Wrench } from "lucide-react";

const TONE_ACCENT: Record<CockpitSnapshot["health"]["tone"], string> = {
  good: "text-primary",
  warn: "text-amber-400",
  bad: "text-destructive",
};

export function HealthHeroWidget({ snapshot }: { snapshot: CockpitSnapshot }) {
  const { health, nextMaintenance } = snapshot;
  const Icon = health.tone === "good" ? Heart : health.tone === "warn" ? Wrench : AlertTriangle;
  const accent = TONE_ACCENT[health.tone];

  return (
    <section
      aria-label="Estado da moto"
      className="surface-elevated rounded-3xl px-6 py-8 sm:px-10 sm:py-12"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div className={`flex items-center gap-3 text-sm uppercase tracking-widest ${accent}`}>
          <Icon className="h-4 w-4" aria-hidden />
          <span>{health.label}</span>
        </div>

        <div className="font-display text-6xl font-bold sm:text-7xl">
          {health.score}
          <span className="ml-1 text-2xl text-muted-foreground sm:text-3xl">%</span>
        </div>

        {nextMaintenance ? (
          <div className="max-w-sm space-y-1">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Próxima manutenção
            </div>
            <div className="text-lg font-semibold">{nextMaintenance.name}</div>
            <div className={`text-sm ${nextMaintenance.status === "overdue" ? "text-destructive" : nextMaintenance.status === "due" ? "text-amber-400" : "text-muted-foreground"}`}>
              {nextMaintenance.remainingLabel}
            </div>
          </div>
        ) : (
          <div className="max-w-sm text-sm text-muted-foreground">
            Nenhuma manutenção próxima do vencimento.
          </div>
        )}
      </div>
    </section>
  );
}