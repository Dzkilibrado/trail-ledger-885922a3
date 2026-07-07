import { TBCard } from "./TBCard";
import { cn } from "@/lib/utils";

export function TBKpiCard({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <TBCard className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-2xl font-black leading-tight">{value}</div>
      {hint && (
        <div className="truncate text-xs text-muted-foreground">{hint}</div>
      )}
    </TBCard>
  );
}