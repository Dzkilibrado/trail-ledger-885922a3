import { TBCard } from "./TBCard";
import { cn } from "@/lib/utils";

export function TBInfoCard({
  title,
  icon,
  className,
  children,
}: {
  title?: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TBCard className={cn("space-y-2", className)}>
      {(title || icon) && (
        <header className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          {title && (
            <h3 className="truncate text-sm font-semibold">{title}</h3>
          )}
        </header>
      )}
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </TBCard>
  );
}