import { AlertTriangle } from "lucide-react";
import { TBButton } from "../primitives/TBButton";
import { cn } from "@/lib/utils";

export function TBErrorState({
  title = "Algo deu errado",
  description = "Tente novamente em instantes.",
  onRetry,
  retryLabel = "Tentar novamente",
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center",
        className,
      )}
    >
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <TBButton variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </TBButton>
      )}
    </div>
  );
}