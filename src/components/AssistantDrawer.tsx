import { useRef, useEffect } from "react";
import { X, Search, ArrowRight, LifeBuoy, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AssistantArticle } from "./AssistantArticle";
import type { useAssistant } from "@/hooks/useAssistant";
import type { AssistantContext } from "@/lib/assistant-context";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type AssistantState = ReturnType<typeof useAssistant>;

interface Props {
  state: AssistantState;
  ctx: AssistantContext;
  moduleStatus: string;
}

export function AssistantDrawer({ state, ctx, moduleStatus }: Props) {
  const {
    open, closeDrawer,
    query, setQuery,
    submitted, submitQuery, resetSearch,
    results, topResult, confidence,
    suggestions,
    loading,
    recordUnanswered,
  } = state;

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus no input ao abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Registrar unanswered após render ZERO
  useEffect(() => {
    if (submitted && confidence === "ZERO") recordUnanswered();
  }, [submitted, confidence, recordUnanswered]);

  if (!open) return null;

  const inMaintenance = moduleStatus === "maintenance";

  async function handleOpenTicket() {
    const motoId = ctx.motorcycleId;
    try {
      const { data, error } = await (supabase as any)
        .from("tickets")
        .insert({
          subject: query || "Dúvida via Assistente TrailBook",
          description: `Via Assistente TrailBook\nPergunta: "${query}"\nTela: ${ctx.pathname}`,
          type: "question",
          module: ctx.moduleKey as any,
          status: "open",
          priority: "medium",
          metadata: {
            source: "assistente_trailbook",
            original_query: query,
            route: ctx.pathname,
            module_key: ctx.moduleKey,
          },
        })
        .select()
        .single();
      if (!error && data) navigate({ to: "/tickets" as never });
    } catch (_) {}
    closeDrawer();
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Assistente TrailBook"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-background shadow-xl
          max-h-[85dvh] outline-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="font-display font-bold text-base leading-none">
              Assistente TrailBook
            </h2>
            {moduleStatus === "beta" && (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                Beta
              </span>
            )}
          </div>
          <button
            onClick={closeDrawer}
            aria-label="Fechar assistente"
            className="rounded-lg p-1.5 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Manutenção */}
        {inMaintenance ? (
          <div className="px-4 pb-6 text-center space-y-2">
            <p className="text-sm font-medium">Assistente em manutenção</p>
            <p className="text-xs text-muted-foreground">
              Estamos aprimorando o Assistente. Tente novamente em breve.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
            {/* Campo de busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); if (submitted) resetSearch(); }}
                onKeyDown={(e) => { if (e.key === "Enter") submitQuery(query); }}
                placeholder="O que você quer fazer ou saber?"
                className="pl-9 pr-16"
                aria-label="Buscar no Assistente"
              />
              {query.trim() && (
                <button
                  onClick={() => submitQuery(query)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
                >
                  Buscar
                </button>
              )}
            </div>

            {/* Estado: carregando */}
            {loading && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Carregando…
              </p>
            )}

            {/* Sugestões contextuais — antes da busca */}
            {!submitted && !loading && suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sugestões para esta tela
                </p>
                {suggestions.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => submitQuery(a.title)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-primary/50"
                  >
                    {a.title}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Resultado ALTA / MÉDIA */}
            {submitted && (confidence === "HIGH" || confidence === "MEDIUM") && topResult && (
              <AssistantArticle
                result={topResult}
                motorcycleId={ctx.motorcycleId}
                onNavigate={closeDrawer}
              />
            )}

            {/* Alternativas para MÉDIA */}
            {submitted && confidence === "MEDIUM" && results.length > 1 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Outras possibilidades
                </p>
                {results.slice(1).map((r) => (
                  <button
                    key={r.article.id}
                    onClick={() => submitQuery(r.article.title)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/50"
                  >
                    {r.article.title}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* BAIXA — sem afirmar resposta */}
            {submitted && confidence === "LOW" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Não encontrei uma correspondência segura para isso.
                </p>
                {results.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Talvez relacionado
                    </p>
                    {results.map((r) => (
                      <button
                        key={r.article.id}
                        onClick={() => submitQuery(r.article.title)}
                        className="flex w-full items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/50"
                      >
                        {r.article.title}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={handleOpenTicket}>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Abrir chamado de suporte
                </Button>
              </div>
            )}

            {/* ZERO */}
            {submitted && confidence === "ZERO" && (
              <div className="space-y-3 text-center">
                <p className="text-sm font-medium">
                  Ainda não tenho uma orientação para isso.
                </p>
                <p className="text-xs text-muted-foreground">
                  Registrei sua dúvida para melhorarmos o Assistente.
                </p>
                <Button className="w-full btn-glow" onClick={handleOpenTicket}>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Abrir chamado de suporte
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
