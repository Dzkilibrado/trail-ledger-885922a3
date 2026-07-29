import { cn } from "@/lib/utils";
import {
  HEALTH_STATUS_DOT,
  HEALTH_STATUS_LABEL,
  HEALTH_STATUS_SOFT,
  type HealthStatus,
} from "@/lib/til/status";

/**
 * Linguagem visual oficial de status do TrailBook Health.
 * 🟢 OK · 🟡 Atenção · 🔴 Necessita ação · ⚪ Dados insuficientes
 */
export function TBStatusPill({
  status,
  label,
  size = "md",
  className,
}: {
  status: HealthStatus;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1",
        HEALTH_STATUS_SOFT[status],
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className,
      )}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", HEALTH_STATUS_DOT[status])} aria-hidden />
      {label ?? HEALTH_STATUS_LABEL[status]}
    </span>
  );
}

export function TBStatusDot({ status, className }: { status: HealthStatus; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", HEALTH_STATUS_DOT[status], className)}
      aria-hidden
    />
  );
}
