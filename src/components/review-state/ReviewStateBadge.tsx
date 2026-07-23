import { cn } from "@/lib/utils";
import type { ReviewStateSnapshot } from "@/lib/review-state";

const TONE: Record<ReviewStateSnapshot["tone"], string> = {
  info: "border-primary/25 bg-primary/10 text-primary",
  attention: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

/**
 * Chip curto com o status oficial de revisão inicial.
 * Puramente informativo — não afeta cálculos.
 */
export function ReviewStateBadge({
  snapshot,
  className,
}: {
  snapshot: ReviewStateSnapshot;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        TONE[snapshot.tone],
        className,
      )}
      title={snapshot.message}
    >
      {snapshot.title}
    </span>
  );
}