import { cn } from "@/lib/utils";

export function TBPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-2xl font-black tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}