import { cn } from "@/lib/utils";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { SearchResult } from "@/lib/assistant-search";
import { useNavigate } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";

interface Props {
  result: SearchResult;
  motorcycleId: string | null;
  onNavigate?: () => void;
}

export function AssistantArticle({ result, motorcycleId, onNavigate }: Props) {
  const { article, confidence } = result;
  const navigate = useNavigate();

  function resolvedRoute(): string | null {
    if (!article.route_template) return null;
    if (article.needs_motorcycle && !motorcycleId) return null;
    return article.route_template.replace("$motorcycleId", motorcycleId ?? "");
  }

  const route = resolvedRoute();
  const needsMoto = article.needs_motorcycle && !motorcycleId;

  function handleCTA() {
    if (needsMoto) {
      navigate({ to: "/motorcycles" as never });
    } else if (route) {
      navigate({ to: route as never });
    }
    onNavigate?.();
  }

  return (
    <div className="space-y-3">
      {/* Confidence badge — apenas MÉDIA */}
      {confidence === "MEDIUM" && (
        <p className="text-xs text-muted-foreground">Isso pode ajudar?</p>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <h3 className="font-semibold text-sm leading-snug">{article.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>

        {/* body_md para ALTA confiança */}
        {confidence === "HIGH" && article.body_md && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm pt-1
            [&_strong]:font-semibold [&_ul]:pl-4 [&_li]:mt-0.5 [&_ol]:pl-4">
            <ReactMarkdown>{article.body_md}</ReactMarkdown>
          </div>
        )}

        {/* Necessita moto */}
        {needsMoto && (
          <p className="text-xs text-muted-foreground italic">
            Para fazer isso, primeiro selecione uma moto.
          </p>
        )}

        {/* CTA */}
        {(route || needsMoto) && (
          <button
            onClick={handleCTA}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {needsMoto ? "Ver minhas motos" : (article.cta_label ?? "Ir para a tela")}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
