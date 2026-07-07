import { ChevronRight } from "lucide-react";
import { TBCard } from "./TBCard";
import { cn } from "@/lib/utils";

export function TBActionCard({
  title,
  description,
  icon,
  onClick,
  className,
  trailing,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <TBCard
      as="button"
      interactive
      onClick={onClick}
      className={cn(
        "grid w-full min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-left",
        className,
      )}
    >
      {icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        {description && (
          <div className="truncate text-xs text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      <span className="shrink-0 text-muted-foreground">
        {trailing ?? <ChevronRight className="h-5 w-5" />}
      </span>
    </TBCard>
  );
}