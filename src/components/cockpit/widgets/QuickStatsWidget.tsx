import type { CockpitSnapshot } from "@/lib/til";
import { brl, formatDate } from "@/lib/trailbook";

export function QuickStatsWidget({ snapshot }: { snapshot: CockpitSnapshot }) {
  const { stats, nextAlert } = snapshot;
  const items = [
    {
      label: "Última atividade",
      value: stats.lastActivityAt ? formatDate(stats.lastActivityAt) : "—",
      hint: stats.lastActivityTitle ?? undefined,
    },
    { label: "Horímetro", value: `${stats.hoursTotal.toFixed(1)} h` },
    { label: "Quilometragem", value: `${stats.kmTotal.toFixed(0)} km` },
    {
      label: "Próximo alerta",
      value: nextAlert?.label ?? "Nenhum",
      tone: nextAlert?.tone,
    },
  ] as const;

  return (
    <section aria-label="Resumo rápido" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-border bg-card px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {it.label}
          </div>
          <div
            className={`mt-1 truncate font-display text-base font-semibold ${
              "tone" in it && it.tone === "bad"
                ? "text-destructive"
                : "tone" in it && it.tone === "warn"
                  ? "text-amber-400"
                  : ""
            }`}
            title={typeof it.value === "string" ? it.value : undefined}
          >
            {it.value}
          </div>
          {"hint" in it && it.hint && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground" title={it.hint}>
              {it.hint}
            </div>
          )}
        </div>
      ))}
      {stats.totalCost > 0 && (
        <div className="col-span-2 rounded-2xl border border-border bg-card px-4 py-3 sm:col-span-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Já investido
          </div>
          <div className="mt-1 font-display text-base font-semibold text-primary">
            {brl(stats.totalCost)}
          </div>
        </div>
      )}
    </section>
  );
}