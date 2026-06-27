import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Crumb = { label: string; to?: string };

/**
 * Cabeçalho padronizado de página interna.
 * - Botão "Voltar" usa o histórico do navegador (com fallback configurável).
 * - Botão "Início" leva para o Dashboard.
 * - Breadcrumb opcional.
 * - Slot de ações à direita (botões contextuais).
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  backTo,
  showBack = true,
}: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  backTo?: string;
  showBack?: boolean;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else if (backTo) {
      router.navigate({ to: backTo });
    } else {
      router.navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {showBack && (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
        )}
        <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground">
          <Home className="h-3.5 w-3.5" /> Início
        </Link>
        {crumbs && crumbs.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 opacity-50" />
                {c.to ? (
                  <Link to={c.to} className="hover:text-foreground">{c.label}</Link>
                ) : (
                  <span className="text-foreground/80">{c.label}</span>
                )}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Botão padronizado de cancelar — fecha dialog ou volta uma página. */
export function CancelButton({ onClick, label = "Cancelar" }: { onClick?: () => void; label?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        if (onClick) onClick();
        else if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
      }}
    >
      {label}
    </Button>
  );
}