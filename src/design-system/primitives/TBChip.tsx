import { cn } from "@/lib/utils";

export function TBChip({
  active = false,
  onClick,
  icon,
  className,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const Comp: React.ElementType = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-muted text-foreground hover:bg-accent",
        className,
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </Comp>
  );
}