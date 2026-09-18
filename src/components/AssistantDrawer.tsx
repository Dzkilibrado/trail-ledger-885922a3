// ============================================================
// AssistantDrawer — Bottom sheet mobile-first do Assistente
// Navegação: home → topics → topic-detail → article | search
// ============================================================

import { useRef, useEffect, useCallback } from "react";
import {
  X, Search, ArrowLeft, ChevronRight, LifeBuoy, Layers,
  Bike, Wrench, FileCheck, HeartPulse, BadgeCheck, ShieldCheck,
  User, Calendar, Banknote, Home,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { useAssistant, TopicGroup } from "@/hooks/useAssistant";
import type { AssistantContext } from "@/lib/assistant-context";
import type { HelpArticle } from "@/lib/assistant-search";

type AssistantState = ReturnType<typeof useAssistant>;

// Mapa de ícones Lucide por nome (mesmo config do hook)
const ICON_MAP: Record<string, React.ElementType> = {
  Bike, Wrench, FileCheck, HeartPulse, BadgeCheck, ShieldCheck,
  User, Calendar, Banknote, LifeBuoy,
};

// Labels de sugestão orientadas à intenção do usuário
const HOME_LABELS: Record<string, { label: string; emoji: string }> = {
  "cadastrar-moto":      { label: "Cadastrar ou gerenciar minha moto", emoji: "🏍️" },
  "registrar-manutencao":{ label: "Registrar uma manutenção",          emoji: "🔧" },
  "plano-manutencao":    { label: "Entender meu plano de manutenção",  emoji: "📅" },
  "passaporte-digital":  { label: "Passaporte Digital",                emoji: "🛡️" },
  "modo-fiscalizacao":   { label: "Laudo e modo fiscalização",         emoji: "📋" },
  "abrir-chamado":       { label: "Preciso de ajuda / suporte",        emoji: "💬" },
};

interface Props {
  state: AssistantState;
  ctx: AssistantContext;
  moduleStatus: string;
}

export function AssistantDrawer({ state, ctx, moduleStatus }: Props) {
  const {
    open, closeDrawer,
    view, goHome, openTopics, openTopic, openArticle, goBack,
    selectedTopic, selectedArticle,
    query, setQuery,
    submitted, submitQuery, resetSearch,
    results, topResult, confidence, related,
    topResultModuleStatus,
    homeSuggestions, topicGroups, suggestions,
    loading,
    recordUnanswered,
    getModuleStatus,
  } = state;

  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef  = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  // Foco ao abrir / devolver ao fechar
  useEffect(() => {
    if (open) {
      fabRef.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      fabRef.current?.focus();
    }
  }, [open]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, closeDrawer]);

  // Registrar unanswered no ZERO
  useEffect(() => {
    if (submitted && confidence === "ZERO") recordUnanswered();
  }, [submitted, confidence, recordUnanswered]);

  if (!open) return null;

  // ── Helpers ─────────────────────────────────────────────────

  function handleSearch(q: string) {
    const t = q.trim();
    if (t) submitQuery(t);
  }

  function resolvedRoute(article: HelpArticle) {
    if (!article.route_template) return null;
    if (article.needs_motorcycle && !ctx.motorcycleId) return null;
    return article.route_template.replace("$motorcycleId", ctx.motorcycleId ?? "");
  }

  function handleCTA(article: HelpArticle) {
    const route = resolvedRoute(article);
    if (article.needs_motorcycle && !ctx.motorcycleId) {
      navigate({ to: "/motorcycles" as never });
    } else if (route) {
      navigate({ to: route as never });
    }
    closeDrawer();
  }

  async function handleOpenTicket() {
    try {
      await supabase.from("tickets").insert({
        title: query.trim() || "Dúvida via Assistente TrailBook",
        description: `Via Assistente TrailBook\nPergunta: "${query}"\nTela: ${ctx.pathname}`,
        type: "question" as const,
        module: "other" as const,
        status: "open" as const,
        priority: "medium" as const,
        metadata: { source: "assistente_trailbook", original_query: query, route: ctx.pathname, module_key: ctx.moduleKey },
      });
      navigate({ to: "/tickets" as never });
    } catch (_) {}
    closeDrawer();
  }

  const showBack = view !== "home";
  const inMaintenance = moduleStatus === "maintenance";

  // ── Layout container ─────────────────────────────────────────

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={closeDrawer} aria-hidden="true" />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Assistente TrailBook"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-background shadow-xl
          max-h-[88dvh] outline-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-border shrink-0" />

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pb-2 pt-1 shrink-0">
          {showBack && (
            <button onClick={goBack} aria-label="Voltar" className="rounded-lg p-1.5 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm leading-tight truncate">
              {view === "topics"       ? "Explorar TrailBook"
               : view === "topic-detail" && selectedTopic ? selectedTopic.label
               : view === "article"   && selectedArticle ? selectedArticle.title
               : "Assistente TrailBook"}
            </h2>
            {view === "home" && moduleStatus === "beta" && (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">Beta</span>
            )}
          </div>
          {view !== "home" && (
            <button onClick={goHome} aria-label="Início do assistente" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
              <Home className="h-4 w-4" />
            </button>
          )}
          <button onClick={closeDrawer} aria-label="Fechar assistente" className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Campo de busca — sempre visível */}
        <div className="px-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (submitted) resetSearch(); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(query); }}
              placeholder="O que você quer fazer ou saber?"
              className="pl-9 pr-16 text-sm h-9"
              aria-label="Buscar no Assistente"
            />
            {query.trim() && (
              <button
                onClick={() => handleSearch(query)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground"
              >
                Buscar
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">

          {/* Manutenção */}
          {inMaintenance && (
            <div className="py-8 text-center space-y-1">
              <p className="text-sm font-medium">Assistente em manutenção</p>
              <p className="text-xs text-muted-foreground">Estamos aprimorando. Tente em breve.</p>
            </div>
          )}

          {/* Carregando */}
          {!inMaintenance && loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          )}

          {/* ── HOME ──────────────────────────────────────────── */}
          {!inMaintenance && !loading && view === "home" && (
            <HomeView
              homeSuggestions={homeSuggestions}
              contextSuggestions={suggestions}
              ctx={ctx}
              onArticle={(a) => { openArticle(a); }}
              onOpenTopics={openTopics}
            />
          )}

          {/* ── TOPICS ────────────────────────────────────────── */}
          {!inMaintenance && !loading && view === "topics" && (
            <TopicsView groups={topicGroups} onTopic={openTopic} />
          )}

          {/* ── TOPIC DETAIL ──────────────────────────────────── */}
          {!inMaintenance && !loading && view === "topic-detail" && selectedTopic && (
            <TopicDetailView
              topic={selectedTopic}
              onArticle={openArticle}
            />
          )}

          {/* ── ARTICLE (via navegação) ────────────────────────── */}
          {!inMaintenance && !loading && view === "article" && selectedArticle && (
            <ArticleView
              article={selectedArticle}
              ctx={ctx}
              related={related}
              moduleStatus={getModuleStatus(selectedArticle)}
              onCTA={() => handleCTA(selectedArticle)}
              onRelated={openArticle}
            />
          )}

          {/* ── SEARCH RESULTS ────────────────────────────────── */}
          {!inMaintenance && view === "search" && (
            <SearchView
              results={results}
              confidence={confidence}
              topResult={topResult}
              related={related}
              topResultModuleStatus={topResultModuleStatus}
              ctx={ctx}
              loading={loading}
              onCTA={(a) => handleCTA(a)}
              onRelated={openArticle}
              onOpenTopics={openTopics}
              onOpenTicket={handleOpenTicket}
            />
          )}

        </div>
      </div>
    </>
  );
}

// ── Sub-views ─────────────────────────────────────────────────

function HomeView({
  homeSuggestions, contextSuggestions, ctx, onArticle, onOpenTopics,
}: {
  homeSuggestions: HelpArticle[];
  contextSuggestions: HelpArticle[];
  ctx: AssistantContext;
  onArticle: (a: HelpArticle) => void;
  onOpenTopics: () => void;
}) {
  // Priorizar sugestões contextuais se fora da home geral
  const isGeneral = ctx.moduleKey === "general" || ctx.moduleKey === "dashboard";
  const primary = isGeneral ? homeSuggestions : contextSuggestions.length >= 2 ? contextSuggestions : homeSuggestions;
  const showContext = !isGeneral && contextSuggestions.length >= 2;

  return (
    <div className="space-y-4">
      {showContext && (
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Nesta tela
        </p>
      )}
      {!showContext && (
        <p className="text-xs text-muted-foreground">
          Escolha uma opção ou escreva o que você precisa.
        </p>
      )}

      {/* Sugestões principais — chips compactos */}
      <div className="space-y-1.5">
        {primary.map((a) => {
          const meta = HOME_LABELS[a.slug];
          return (
            <button
              key={a.id}
              onClick={() => onArticle(a)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5
                text-left text-sm hover:border-primary/40 hover:bg-muted/60 transition-colors"
              aria-label={meta?.label ?? a.title}
            >
              <span className="text-base shrink-0">{meta?.emoji ?? "💡"}</span>
              <span className="flex-1 leading-snug text-sm">{meta?.label ?? a.title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Ver todas as opções */}
      <button
        onClick={onOpenTopics}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/70
          bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
      >
        <Layers className="h-3.5 w-3.5" />
        Ver todas as opções
      </button>
    </div>
  );
}

function TopicsView({ groups, onTopic }: { groups: TopicGroup[]; onTopic: (t: TopicGroup) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pb-1">
        Explorar por área
      </p>
      {groups.map((g) => {
        const Icon = ICON_MAP[g.icon] ?? Wrench;
        return (
          <button
            key={g.key}
            onClick={() => onTopic(g)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5
              text-left hover:border-primary/40 hover:bg-muted/60 transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
            <span className="flex-1 text-sm">{g.label}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">{g.articles.length}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

function TopicDetailView({ topic, onArticle }: { topic: TopicGroup; onArticle: (a: HelpArticle) => void }) {
  return (
    <div className="space-y-1.5">
      {topic.articles.map((a) => (
        <button
          key={a.id}
          onClick={() => onArticle(a)}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5
            text-left hover:border-primary/40 hover:bg-muted/60 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">{a.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.summary}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function ArticleView({
  article, ctx, related, moduleStatus, onCTA, onRelated,
}: {
  article: HelpArticle;
  ctx: AssistantContext;
  related: HelpArticle[];
  moduleStatus: import("@/lib/modules").ModuleStatus | null;
  onCTA: () => void;
  onRelated: (a: HelpArticle) => void;
}) {
  const needsMoto = article.needs_motorcycle && !ctx.motorcycleId;
  const isUnavailable = moduleStatus === "disabled" || moduleStatus === "maintenance";
  const hasRoute = !!(article.route_template || needsMoto) && !isUnavailable;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>
        {article.body_md && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm pt-1
            [&_strong]:font-semibold [&_ul]:pl-4 [&_li]:mt-0.5 [&_h2]:text-sm [&_h2]:font-semibold">
            <ReactMarkdown>{article.body_md}</ReactMarkdown>
          </div>
        )}
        {needsMoto && !isUnavailable && (
          <p className="text-xs text-muted-foreground italic">Para fazer isso, selecione uma moto primeiro.</p>
        )}
        {moduleStatus === "maintenance" && (
          <p className="text-xs text-amber-500 dark:text-amber-400 font-medium">
            🚧 Esta funcionalidade está temporariamente em manutenção.
          </p>
        )}
        {moduleStatus === "disabled" && (
          <p className="text-xs text-muted-foreground font-medium">
            Esta funcionalidade ainda não está disponível.
          </p>
        )}
        {hasRoute && (
          <Button size="sm" className="w-full btn-glow mt-2" onClick={onCTA}>
            {needsMoto ? "Ver minhas motos" : (article.cta_label ?? "Ir para a tela")}
          </Button>
        )}
      </div>

      {related.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Também posso ajudar com
          </p>
          {related.slice(0, 3).map((r) => (
            <button
              key={r.id}
              onClick={() => onRelated(r)}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2
                text-left text-sm hover:border-primary/40 hover:bg-muted/60 transition-colors"
            >
              <span className="flex-1 leading-snug">{r.title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchView({
  results, confidence, topResult, related, topResultModuleStatus, ctx, loading,
  onCTA, onRelated, onOpenTopics, onOpenTicket,
}: {
  results: ReturnType<typeof useAssistant>["results"];
  confidence: ReturnType<typeof useAssistant>["confidence"];
  topResult: ReturnType<typeof useAssistant>["topResult"];
  related: ReturnType<typeof useAssistant>["related"];
  topResultModuleStatus: ReturnType<typeof useAssistant>["topResultModuleStatus"];
  ctx: AssistantContext;
  loading: boolean;
  onCTA: (a: HelpArticle) => void;
  onRelated: (a: HelpArticle) => void;
  onOpenTopics: () => void;
  onOpenTicket: () => void;
}) {
  if (loading) return <p className="py-6 text-center text-sm text-muted-foreground">Buscando…</p>;

  if (confidence === "HIGH" || confidence === "MEDIUM") {
    const article = topResult!.article;
    const needsMoto = article.needs_motorcycle && !ctx.motorcycleId;
    const isUnavailable = topResultModuleStatus === "disabled" || topResultModuleStatus === "maintenance";
    const hasRoute = !!(article.route_template || needsMoto) && !isUnavailable;

    return (
      <div className="space-y-3">
        {confidence === "MEDIUM" && (
          <p className="text-xs text-muted-foreground">Isso pode ajudar?</p>
        )}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="font-semibold text-sm">{article.title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>
          {confidence === "HIGH" && article.body_md && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm pt-1
              [&_strong]:font-semibold [&_ul]:pl-4 [&_li]:mt-0.5 [&_h2]:text-sm [&_h2]:font-semibold">
              <ReactMarkdown>{article.body_md}</ReactMarkdown>
            </div>
          )}
          {topResultModuleStatus === "maintenance" && (
            <p className="text-xs text-amber-500 dark:text-amber-400 font-medium">
              🚧 Esta funcionalidade está temporariamente em manutenção.
            </p>
          )}
          {topResultModuleStatus === "disabled" && (
            <p className="text-xs text-muted-foreground font-medium">
              Esta funcionalidade ainda não está disponível.
            </p>
          )}
          {needsMoto && !isUnavailable && (
            <p className="text-xs text-muted-foreground italic">Selecione uma moto primeiro.</p>
          )}
          {hasRoute && (
            <Button size="sm" className="w-full btn-glow mt-1" onClick={() => onCTA(article)}>
              {needsMoto ? "Ver minhas motos" : (article.cta_label ?? "Ir para a tela")}
            </Button>
          )}
        </div>

        {/* Alternativas para MÉDIA */}
        {confidence === "MEDIUM" && results.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Outras opções</p>
            {results.slice(1).map((r) => (
              <button key={r.article.id} onClick={() => onRelated(r.article)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-left text-sm hover:border-primary/40 transition-colors">
                <span className="flex-1">{r.article.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Relacionados */}
        {related.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Também posso ajudar com</p>
            {related.slice(0, 2).map((r) => (
              <button key={r.id} onClick={() => onRelated(r)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-left text-sm hover:border-primary/40 transition-colors">
                <span className="flex-1">{r.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (confidence === "LOW") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Não encontrei uma correspondência segura para isso.</p>
        {results.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Talvez relacionado</p>
            {results.map((r) => (
              <button key={r.article.id} onClick={() => onRelated(r.article)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-left text-sm hover:border-primary/40 transition-colors">
                <span className="flex-1">{r.article.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" className="w-full" onClick={onOpenTopics}>
            <Layers className="mr-2 h-4 w-4" /> Ver opções de ajuda
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={onOpenTicket}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Abrir chamado de suporte
          </Button>
        </div>
      </div>
    );
  }

  // ZERO
  return (
    <div className="space-y-3 text-center pt-2">
      <p className="text-sm font-medium">Ainda não tenho uma orientação para isso.</p>
      <p className="text-xs text-muted-foreground">Registrei sua dúvida para melhorarmos o Assistente.</p>
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="w-full" onClick={onOpenTopics}>
          <Layers className="mr-2 h-4 w-4" /> Ver opções de ajuda
        </Button>
        <Button className="w-full btn-glow" onClick={onOpenTicket}>
          <LifeBuoy className="mr-2 h-4 w-4" /> Abrir chamado de suporte
        </Button>
      </div>
    </div>
  );
}
