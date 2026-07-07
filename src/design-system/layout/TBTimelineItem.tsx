import { cn } from "@/lib/utils";

export function TBTimelineItem({
  title,
  meta,
  icon,
  onClick,
  className,
  children,
  isLast = false,
}: {
  title: string;
  meta?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  isLast?: boolean;
}) {
  const content = (
    <div className="min-w-0 flex-1 space-y-1 pb-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
        <div className="truncate text-sm font-semibold">{title}</div>
        {meta && (
          <div className="shrink-0 text-xs text-muted-foreground">{meta}</div>
        )}
      </div>
      {children && (
        <div className="text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
  return (
    <div
      className={cn(
        "relative flex gap-3",
        !isLast &&
          "before:absolute before:left-[15px] before:top-8 before:h-[calc(100%-1.5rem)] before:w-px before:bg-border",
        className,
      )}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
        {icon}
      </div>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 rounded-xl text-left transition-colors hover:bg-accent/40"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}