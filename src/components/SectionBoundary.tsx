import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Isolamento por seção: uma falha em um bloco secundário (selos, diagnóstico,
 * atalhos) nunca deve derrubar a tela inteira. Mostra erro apenas no bloco.
 */
export class SectionBoundary extends Component<
  { children: ReactNode; title?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section
        role="alert"
        className="surface-elevated rounded-2xl border border-border p-4 text-center"
      >
        <p className="text-sm font-semibold">
          {this.props.title ?? "Não foi possível carregar este bloco"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          As demais informações continuam disponíveis.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false })}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </section>
    );
  }
}