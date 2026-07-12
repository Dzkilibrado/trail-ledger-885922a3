import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Empty State padronizado (Sprint v1.6 — Bloco C).
 * Uso: listas vazias, resultados de busca sem retorno, sem chamados, etc.
 * Mantém tom neutro e ação primária opcional. Descoberta progressiva:
 * o CTA deve levar o usuário à ação mais provável.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-elevated rounded-2xl border border-dashed border-border p-10 text-center",
        className,
      )}
    >
      {Icon && <Icon className="mx-auto h-10 w-10 text-muted-foreground" />}
      <p className="mt-3 font-display text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 inline-flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}