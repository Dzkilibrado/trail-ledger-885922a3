import { TBCard } from "./TBCard";
import { TBBadge, type TBSeverity } from "../primitives/TBBadge";
import { cn } from "@/lib/utils";

export function TBStatusCard({
  title,
  description,
  severity,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  severity: TBSeverity;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <TBCard className={cn("space-y-2", className)}>
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {icon && (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {description && (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <TBBadge severity={severity} className="shrink-0" />
      </header>
      {action && <div className="pt-1">{action}</div>}
    </TBCard>
  );
}