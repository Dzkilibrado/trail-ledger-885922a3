import { cn } from "@/lib/utils";

export function TBFormActions({
  className,
  sticky = true,
  children,
}: {
  className?: string;
  sticky?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
        sticky &&
          "sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}