import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spinner inline padronizado (Sprint v1.6 — Bloco C).
 * Usar em botões e ações — nunca como carregamento de tela cheia
 * (isso é papel dos componentes em `src/components/Skeletons.tsx`).
 */
export function InlineSpinner({
  className,
  label = "Carregando",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Loader2
      className={cn("h-4 w-4 animate-spin", className)}
      aria-label={label}
      role="status"
    />
  );
}