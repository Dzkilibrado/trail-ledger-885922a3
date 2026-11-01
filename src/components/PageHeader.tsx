import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Crumb = { label: string; to?: string };

/**
 * Cabeçalho padronizado de página interna.
 *
 * Layout em três linhas bem separadas:
 *   1. Barra de navegação: [← Voltar]  ·  espaço  ·  [⌂ Início]
 *   2. Breadcrumb discreto (apenas crumbs intermediários, sem "Início")
 *   3. Título + descrição + ações
 *
 * Princípio: o usuário nunca se sente preso. "Voltar" e "Início" são
 * sempre visíveis e facilmente tocáveis (área mínima 44 px).
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
    if (backTo) {
      router.navigate({ to: backTo });
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="mb-6 space-y-4">
      {/* ── Linha 1: Voltar  ·  Início ── */}
      <div className="flex items-center justify-between gap-2">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Voltar</span>
          </button>
        ) : (
          /* placeholder para manter o Início sempre à direita */
          <span />
        )}

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80"
          title="Ir para o início"
        >
          <Home className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Início</span>
        </Link>
      </div>

      {/* ── Linha 2: Breadcrumb (só se houver crumbs) ── */}
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Localização" className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />}
              {c.to ? (
                <Link
                  to={c.to}
                  className="truncate max-w-[120px] sm:max-w-[200px] rounded hover:text-foreground underline-offset-2 hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="truncate max-w-[120px] sm:max-w-[200px] font-medium text-foreground/70">
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* ── Linha 3: Título + descrição + ações ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
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