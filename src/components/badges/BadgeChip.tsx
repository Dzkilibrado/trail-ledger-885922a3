import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BadgeEvaluation } from "@/lib/badges";
import { cn } from "@/lib/utils";
import { BadgeTooltipContent } from "./BadgeTooltip";

const TIER_STYLE = {
  bronze: "border-amber-700/40 bg-amber-900/20 text-amber-200",
  silver: "border-slate-400/40 bg-slate-500/15 text-slate-100",
  gold: "border-yellow-500/50 bg-yellow-500/15 text-yellow-200",
  signature: "border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 text-white",
} as const;

const LOCKED_STYLE = "border-border/60 bg-muted/40 text-muted-foreground opacity-70";
const PARTIAL_STYLE = "border-amber-500/30 bg-amber-500/5 text-amber-200/80";

/**
 * Pílula compacta reutilizada em headers (Central, Passaporte, Saúde, Docs).
 * Tooltip mostra significado + critérios atendidos/pendentes.
 */
export function BadgeChip({
  evaluation,
  size = "md",
}: {
  evaluation: BadgeEvaluation;
  size?: "sm" | "md";
}) {
  const { definition: b, state } = evaluation;
  const style =
    state === "earned" ? TIER_STYLE[b.tier]
    : state === "partial" ? PARTIAL_STYLE
    : LOCKED_STYLE;

  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide",
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-[11px]",
    style,
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cls} role="img" aria-label={`Selo ${b.title} — ${state}`}>
            <span aria-hidden>{b.glyph}</span>
            <span>{b.short}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-3">
          <BadgeTooltipContent evaluation={evaluation} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}