import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TBLoadingState({
  variant = "spinner",
  label = "Carregando…",
  rows = 3,
  className,
}: {
  variant?: "spinner" | "skeleton";
  label?: string;
  rows?: number;
  className?: string;
}) {
  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-3", className)} aria-busy>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground",
        className,
      )}
      aria-busy
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}