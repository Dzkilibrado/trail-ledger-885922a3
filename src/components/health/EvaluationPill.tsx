import { cn } from "@/lib/utils";
import {
  EVALUATION_DOT,
  EVALUATION_LABEL,
  EVALUATION_SOFT,
  type EvaluationState,
} from "@/lib/ui/evaluation";

/**
 * Selo oficial de estado da avaliação (TrailBook Health 4.0).
 * Substitui qualquer nota/percentual na experiência do proprietário.
 */
export function EvaluationPill({
  state,
  label,
  size = "md",
  className,
}: {
  state: EvaluationState;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1",
        EVALUATION_SOFT[state],
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className,
      )}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", EVALUATION_DOT[state])} aria-hidden />
      {label ?? EVALUATION_LABEL[state]}
    </span>
  );
}
