import type { BadgeEvaluation } from "@/lib/badges";
import { BadgeTooltipContent } from "./BadgeTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TIER_ACCENT = {
  bronze: "border-amber-700/40",
  silver: "border-slate-400/40",
  gold: "border-yellow-500/50",
  signature: "border-fuchsia-400/50",
} as const;

/**
 * Grade completa com estado visual por selo. Usada no Passaporte Digital.
 */
export function BadgeGrid({ evaluations }: { evaluations: BadgeEvaluation[] }) {
  if (evaluations.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {evaluations.map((ev) => {
          const b = ev.definition;
          const isEarned = ev.state === "earned";
          const isPartial = ev.state === "partial";
          return (
            <Tooltip key={b.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                    isEarned
                      ? `${TIER_ACCENT[b.tier]} bg-card hover:-translate-y-0.5`
                      : isPartial
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-400/40"
                        : "border-border/60 bg-muted/20 opacity-70 hover:opacity-100",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg",
                      isEarned ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    {b.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{b.title}</div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {b.description}
                    </p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full transition-all",
                          isEarned ? "bg-emerald-400" : isPartial ? "bg-amber-400" : "bg-muted-foreground/40",
                        )}
                        style={{ width: `${Math.round(ev.progress * 100)}%` }}
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