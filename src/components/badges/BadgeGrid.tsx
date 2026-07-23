import { Check, Clock, Lock } from "lucide-react";
import type { BadgeEvaluation } from "@/lib/badges";
import { BadgeTooltipContent } from "./BadgeTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Acento sutil por tier — usado apenas como fio interno no estado "earned".
 * Mantém a leitura calma (fundo neutro) e evita "arco-íris" no grid.
 */
const TIER_RING = {
  bronze: "ring-amber-500/25",
  silver: "ring-slate-300/25",
  gold: "ring-yellow-400/30",
  signature: "ring-fuchsia-300/30",
} as const;

/**
 * Grade completa com estado visual por selo. Usada no Passaporte Digital.
 */
export function BadgeGrid({ evaluations }: { evaluations: BadgeEvaluation[] }) {
  if (evaluations.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {evaluations.map((ev) => {
          const b = ev.definition;
          const isEarned = ev.state === "earned";
          const isPartial = ev.state === "partial";
          const pct = Math.round(ev.progress * 100);

          const stateChip = isEarned
            ? { icon: Check, label: "Conquistado", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
            : isPartial
              ? { icon: Clock, label: `${pct}% concluído`, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
              : { icon: Lock, label: "A conquistar", cls: "bg-muted text-muted-foreground border-border" };
          const StateIcon = stateChip.icon;

          return (
            <Tooltip key={b.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${b.title} — ${stateChip.label}`}
                  className={cn(
                    "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-card p-3.5 text-left transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isEarned
                      ? cn("border-border/70 ring-1 ring-inset", TIER_RING[b.tier], "hover:-translate-y-0.5 hover:border-border")
                      : isPartial
                        ? "border-border/60 hover:border-amber-400/40"
                        : "border-border/50 bg-muted/10 opacity-80 hover:opacity-100",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl leading-none",
                      isEarned
                        ? "bg-emerald-500/10 text-emerald-300"
                        : isPartial
                          ? "bg-amber-500/10 text-amber-200"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {b.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-foreground">{b.title}</div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                          stateChip.cls,
                        )}
                      >
                        <StateIcon className="h-2.5 w-2.5" aria-hidden />
                        <span className="hidden sm:inline">{stateChip.label}</span>
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {b.description}
                    </p>
                    <div
                      className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted/70"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isEarned ? "bg-emerald-400" : isPartial ? "bg-amber-400" : "bg-muted-foreground/30",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="p-3">
                <BadgeTooltipContent evaluation={ev} />
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}