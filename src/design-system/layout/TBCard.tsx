import { cn } from "@/lib/utils";

export function TBCard({
  className,
  children,
  as: Comp = "div",
  interactive = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  as?: React.ElementType;
  interactive?: boolean;
}) {
  return (
    <Comp
      className={cn(
        "rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5",
        interactive &&
          "transition-colors hover:bg-accent/40 active:bg-accent/60",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}