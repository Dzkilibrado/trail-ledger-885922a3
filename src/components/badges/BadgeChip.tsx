import { memo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BadgeEvaluation } from "@/lib/badges";
import { cn } from "@/lib/utils";
import { BadgeTooltipContent } from "./BadgeTooltip";
import { BADGE_TIER_STYLE } from "@/lib/ui/status-styles";

const LOCKED_STYLE = "border-border/60 bg-muted/40 text-muted-foreground opacity-70";
const PARTIAL_STYLE = "border-amber-500/30 bg-amber-500/5 text-amber-200/80";

/**
 * Pílula compacta reutilizada em headers (Central, Passaporte, Saúde, Docs).
 * Tooltip mostra significado + critérios atendidos/pendentes.
 */
function BadgeChipImpl({
  evaluation,
  size = "md",
}: {
  evaluation: BadgeEvaluation;
  size?: "sm" | "md";
}) {
  const { definition: b, state } = evaluation;
  const style =
    state === "earned" ? BADGE_TIER_STYLE[b.tier]
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

/** Memoizado — renderizado em listas (Passaporte, Central, Documentos). */
export const BadgeChip = memo(BadgeChipImpl);