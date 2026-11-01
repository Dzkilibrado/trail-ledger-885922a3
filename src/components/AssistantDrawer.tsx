// ============================================================
// AssistantDrawer — Bottom sheet mobile-first do Assistente
// Navegação: home → topics → topic-detail → article | search
// ============================================================

import { useRef, useEffect, useCallback } from "react";
import {
  X, Search, ArrowLeft, ChevronRight, LifeBuoy, Layers,
  Bike, Wrench, FileCheck, HeartPulse, BadgeCheck, ShieldCheck,
  User, Calendar, Banknote, Home,
  LayoutDashboard, ClipboardList, Settings2, FileText,
  Stethoscope, AlertTriangle, Package, StickyNote, Zap,
  MapPin, BookOpen,
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

// ── Atalhos rápidos — navegação direta por ação ───────────────
// Cada atalho guia o usuário até um destino específico da nova estrutura
// Usado no HomeView quando não há sugestões contextuais suficientes

interface QuickShortcut {
  key: string;
  emoji: string;
  label: string;
  sublabel: string;
  color: string;
  path: string[]; // trilha de navegação para exibir ao usuário
  route?: string; // rota direta (sem $motorcycleId)
  routeTemplate?: string; // rota com $motorcycleId
  needsMoto?: boolean;
}

const QUICK_SHORTCUTS: QuickShortcut[] = [
  {
    key: "painel",
    emoji: "📊",
    label: "Painel da Moto",
    sublabel: "Saúde geral, alertas e próximas revisões",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    path: ["Minha Moto", "Painel"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=geral",
    needsMoto: true,
  },
  {
    key: "checkup",
    emoji: "🩺",
    label: "Realizar Check-up",
    sublabel: "Avaliar condições e gerar laudo de inspeção",
    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    path: ["Minha Moto", "Check-up"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=checkup",
    needsMoto: true,
  },
  {
    key: "lancamentos-manutencao",
    emoji: "🔧",
    label: "Manutenções",
    sublabel: "Ver, editar ou excluir revisões e reparos",
    color: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
    path: ["Minha Moto", "Lançamentos", "Manutenções"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
  },
  {
    key: "lancamentos-uso",
    emoji: "🏍️",
    label: "Uso (horas/km)",
    sublabel: "Ver, editar ou excluir registros de uso",
    color: "bg-primary/10 border-primary/20 text-primary",
    path: ["Minha Moto", "Lançamentos", "Uso"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
  },
  {
    key: "lancamentos-sinistro",
    emoji: "⚠️",
    label: "Sinistros",
    sublabel: "Ver, editar ou excluir quedas e avarias",
    color: "bg-destructive/10 border-destructive/20 text-destructive",
    path: ["Minha Moto", "Lançamentos", "Sinistros"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
  },
  {
    key: "pecas",
    emoji: "⚙️",
    label: "Peças Instaladas",
    sublabel: "Componentes e histórico de substituição",
    color: "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400",
    path: ["Minha Moto", "Peças"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=componentes",
    needsMoto: true,
  },
  {
    key: "documentos",
    emoji: "📄",
    label: "Documentos",
    sublabel: "CRLV, laudos e arquivos da moto",
    color: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
    path: ["Minha Moto", "Documentos"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=documentos",
    needsMoto: true,
  },
  {
    key: "editar-lancamento",
    emoji: "✏️",
    label: "Editar Lançamento",
    sublabel: "Corrigir ou atualizar qualquer registro",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    path: ["Minha Moto", "Lançamentos", "Categoria", "Editar"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
  },
  {
    key: "cadastrar-moto",
    emoji: "🏍️",
    label: "Cadastrar Nova Moto",
    sublabel: "Adicionar uma moto ao seu perfil",
    color: "bg-muted/60 border-border text-foreground",
    path: ["Minhas Motos", "Cadastrar"],
    route: "/motorcycles/new",
  },
];

// Labels de sugestão orientadas à intenção do usuário
// Linguagem de motociclista — sem termos técnicos internos
const HOME_LABELS: Record<string, { label: string; emoji: string; path?: string[] }> = {
  "cadastrar-moto": {
    label: "Cadastrar ou gerenciar minha moto",
    emoji: "🏍️",
    path: ["Minhas Motos"],
  },
  "registrar-manutencao": {
    label: "Registrar uma manutenção",
    emoji: "🔧",
    path: ["Minha Moto", "Lançamentos", "Manutenções"],
  },
  "health-avaliacao": {
    label: "Ver a saúde da minha moto",
    emoji: "❤️",
    path: ["Minha Moto", "Painel"],
  },
  "check-up-laudo": {
    label: "Gerar ou consultar um Laudo",
    emoji: "📋",
    path: ["Minha Moto", "Check-up"],
  },
  "plano-manutencao": {
    label: "Entender meu plano de manutenção",
    emoji: "📅",
    path: ["Minha Moto", "Painel"],
  },
  "passaporte-digital": {
    label: "Compartilhar o Passaporte Digital",
    emoji: "🛡️",
    path: ["Passaporte Digital"],
  },
  "fiscalizacao-laudo": {
    label: "Apresentar minha moto em fiscalização",
    emoji: "🔵",
    path: ["Passaporte Digital", "Fiscalização"],
  },
  "selos-qualidade": {
    label: "Entender os Selos de Qualidade",
    emoji: "🏅",
    path: ["Minha Moto", "Painel", "Selos"],
  },
  "meus-itens": {
    label: "Meus Itens — biblioteca pessoal",
    emoji: "📦",
    path: ["Meus Itens"],
  },
  "abrir-chamado": {
    label: "Preciso de ajuda / suporte",
    emoji: "💬",
    path: ["Suporte", "Abrir Chamado"],
  },
  // Novos caminhos — nova navegação
  "painel-moto": {
    label: "Ver o Painel da minha moto",
    emoji: "📊",
    path: ["Minha Moto", "Painel"],
  },
  "lancamentos-manutencao": {
    label: "Consultar ou editar manutenções",
    emoji: "🔧",
    path: ["Minha Moto", "Lançamentos", "Manutenções"],
  },
  "lancamentos-uso": {
    label: "Ver, registrar ou editar uso (horas/km)",
    emoji: "🏍️",
    path: ["Minha Moto", "Lançamentos", "Uso"],
  },
  "lancamentos-sinistro": {
    label: "Registrar, consultar ou editar sinistros",
    emoji: "⚠️",
    path: ["Minha Moto", "Lançamentos", "Sinistros"],
  },
  "lancamentos-acessorio": {
    label: "Gerenciar acessórios e equipamentos",
    emoji: "🎽",
    path: ["Minha Moto", "Lançamentos", "Acessórios"],
  },
  "lancamentos-nota": {
    label: "Ver ou criar notas livres",
    emoji: "📝",
    path: ["Minha Moto", "Lançamentos", "Notas"],
  },
  // Editar / excluir lançamentos — fluxo específico
  "editar-lancamento": {
    label: "Editar ou excluir um lançamento",
    emoji: "✏️",
    path: ["Minha Moto", "Lançamentos", "Categoria", "→ Editar / Excluir"],
  },
  "excluir-lancamento": {
    label: "Excluir um lançamento registrado",
    emoji: "🗑️",
    path: ["Minha Moto", "Lançamentos", "Categoria", "→ Excluir"],
  },
  "pecas-instaladas": {
    label: "Ver peças e componentes instalados",
    emoji: "⚙️",
    path: ["Minha Moto", "Peças"],
  },
  "documentos-moto": {
    label: "Acessar documentos e arquivos da moto",
    emoji: "📄",
    path: ["Minha Moto", "Documentos"],
  },
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

  function handleShortcut(s: QuickShortcut) {
    if (s.needsMoto && !ctx.motorcycleId) {
      navigate({ to: "/motorcycles" as never });
    } else if (s.routeTemplate && ctx.motorcycleId) {
      navigate({ to: s.routeTemplate.replace("$motorcycleId", ctx.motorcycleId) as never });
    } else if (s.route) {
      navigate({ to: s.route as never });
    }
    closeDrawer();
  }

  async function handleOpenTicket() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("tickets").insert({
        user_id: user.id,
        title: query.trim() || "Dúvida via Assistente TrailBook",
        description: `Via Assistente TrailBook\nPergunta: "${query}"\nTela: ${ctx.pathname}`,
        type: "question" as const,
        module: "other" as const,
        status: "open" as const,
        priority: "medium" as const,
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
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closeDrawer} aria-hidden="true" />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Assistente TrailBook"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-background shadow-2xl
          max-h-[92dvh] outline-none border-t border-border/50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 mb-1 h-1 w-12 rounded-full bg-border/60 shrink-0" />

        {/* Header melhorado */}
        <div className="flex items-center gap-2 px-4 pb-3 pt-2 shrink-0 border-b border-border/40">
          {showBack && (
            <button
              onClick={goBack}
              aria-label="Voltar"
              className="rounded-xl p-2 hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {/* Ícone + título */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {!showBack && (
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-sm leading-tight truncate">
                {view === "topics"          ? "Explorar TrailBook"
                 : view === "topic-detail" && selectedTopic ? selectedTopic.label
                 : view === "article"      && selectedArticle ? selectedArticle.title
                 : "Assistente TrailBook"}
              </h2>
              {view === "home" && (
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Guia inteligente de navegação
                </p>
              )}
            </div>
          </div>

          {view !== "home" && (
            <button
              onClick={goHome}
              aria-label="Início do assistente"
              className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground"
            >
              <Home className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={closeDrawer}
            aria-label="Fechar assistente"
            className="rounded-xl p-2 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Campo de busca — sempre visível */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (submitted) resetSearch(); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(query); }}
              placeholder="O que você quer fazer ou saber?"
              className="pl-9 pr-16 text-sm h-10 rounded-xl bg-muted/40 border-border/60 focus:bg-background"
              aria-label="Buscar no Assistente"
            />
            {query.trim() && (
              <button
                onClick={() => handleSearch(query)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-2.5 py-1
                  text-[11px] font-semibold text-primary-foreground transition-opacity"
              >
                Buscar
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1 space-y-3">

          {/* Manutenção */}
          {inMaintenance && (
            <div className="py-10 text-center space-y-2">
              <div className="text-3xl">🚧</div>
              <p className="text-sm font-medium">Assistente em manutenção</p>
              <p className="text-xs text-muted-foreground">Estamos aprimorando. Tente em breve.</p>
            </div>
          )}

          {/* Carregando */}
          {!inMaintenance && loading && (
            <div className="py-10 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">Carregando…</p>
            </div>
          )}

          {/* ── HOME ──────────────────────────────────────────── */}
          {!inMaintenance && !loading && view === "home" && (
            <HomeView
              homeSuggestions={homeSuggestions}
              contextSuggestions={suggestions}
              ctx={ctx}
              onArticle={(a) => { openArticle(a); }}
              onOpenTopics={openTopics}
              onShortcut={handleShortcut}
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

// Trilha de navegação visual (breadcrumb compacto)
function NavPath({ path }: { path: string[] }) {
  if (!path.length) return null;
  return (
    <div className="flex items-center gap-0.5 mt-1 flex-wrap">
      {path.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />}
          <span className="text-[10px] text-muted-foreground/70 leading-tight">{seg}</span>
        </span>
      ))}
    </div>
  );
}

function HomeView({
  homeSuggestions, contextSuggestions, ctx, onArticle, onOpenTopics, onShortcut,
}: {
  homeSuggestions: HelpArticle[];
  contextSuggestions: HelpArticle[];
  ctx: AssistantContext;
  onArticle: (a: HelpArticle) => void;
  onOpenTopics: () => void;
  onShortcut: (s: QuickShortcut) => void;
}) {
  const isGeneral = ctx.moduleKey === "general" || ctx.moduleKey === "dashboard";
  const hasContextSuggestions = !isGeneral && contextSuggestions.length >= 2;
  const primary = hasContextSuggestions ? contextSuggestions : homeSuggestions;

  // Shortcuts de navegação direta — exibidos na home para orientar o usuário
  const shortcuts = ctx.motorcycleId
    ? QUICK_SHORTCUTS.filter((s) => s.needsMoto)
    : QUICK_SHORTCUTS.filter((s) => !s.needsMoto);

  return (
    <div className="space-y-4">

      {/* Banner de boas-vindas */}
      {isGeneral && (
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-3.5 flex items-start gap-3">
          <div className="text-2xl mt-0.5">🏍️</div>
          <div>
            <p className="text-sm font-medium leading-snug">Bem-vindo ao Assistente TrailBook</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Escolha uma opção abaixo ou escreva o que você precisa fazer.
              Qualquer dúvida, eu te guio até o lugar certo.
            </p>
          </div>
        </div>
      )}

      {/* Sugestões contextuais (quando dentro de uma tela específica) */}
      {hasContextSuggestions && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary/60" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Nesta tela
            </p>
          </div>
          {primary.map((a) => {
            const meta = HOME_LABELS[a.slug];
            return (
              <button
                key={a.id}
                onClick={() => onArticle(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5
                  text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group"
                aria-label={meta?.label ?? a.title}
              >
                <span className="text-lg shrink-0">{meta?.emoji ?? "💡"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{meta?.label ?? a.title}</p>
                  {meta?.path && <NavPath path={meta.path} />}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* Atalhos rápidos de navegação — grid 2 colunas */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary/60" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {ctx.motorcycleId ? "Ir direto para" : "Ações rápidas"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {shortcuts.slice(0, 6).map((s) => (
            <button
              key={s.key}
              onClick={() => onShortcut(s)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                "hover:brightness-95 dark:hover:brightness-110",
                s.color,
              )}
            >
              <span className="text-xl">{s.emoji}</span>
              <div>
                <p className="text-xs font-semibold leading-tight">{s.label}</p>
                <p className="text-[10px] opacity-70 leading-tight mt-0.5 line-clamp-2">{s.sublabel}</p>
              </div>
              <NavPath path={s.path} />
            </button>
          ))}
        </div>

        {/* Guia de edição/exclusão — sempre visível quando tem moto */}
        {ctx.motorcycleId && (
          <StepGuide
            title="Como editar ou excluir um lançamento"
            steps={[
              { icon: "🏍️", text: "Abra a tela da sua moto" },
              { icon: "📋", text: "Toque em Lançamentos no menu" },
              { icon: "🔧", text: "Escolha a categoria (Manutenções, Uso, Sinistros, Acessórios ou Notas)" },
              { icon: "✏️", text: "Na lista, toque em Editar ou Excluir ao lado do registro desejado" },
            ]}
          />
        )}
      </div>

      {/* Separador */}
      <div className="border-t border-border/40" />

      {/* Sugestões do assistente (KB) — quando não contextual */}
      {!hasContextSuggestions && homeSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-primary/60" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Guias e tutoriais
            </p>
          </div>
          {homeSuggestions.map((a) => {
            const meta = HOME_LABELS[a.slug];
            return (
              <button
                key={a.id}
                onClick={() => onArticle(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5
                  text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group"
                aria-label={meta?.label ?? a.title}
              >
                <span className="text-base shrink-0">{meta?.emoji ?? "💡"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{meta?.label ?? a.title}</p>
                  {meta?.path && <NavPath path={meta.path} />}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* Ver todas as opções */}
      <button
        onClick={onOpenTopics}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/70
          bg-muted/30 px-3 py-2.5 text-xs font-medium text-muted-foreground
          hover:text-foreground hover:border-border hover:bg-muted/50 transition-colors"
      >
        <Layers className="h-3.5 w-3.5" />
        Ver todas as áreas de ajuda
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
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3
              text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary/70" aria-hidden="true" />
            </div>
            <span className="flex-1 text-sm font-medium">{g.label}</span>
            <span className="text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground shrink-0">
              {g.articles.length}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
          </button>
        );
      })}
    </div>
  );
}

function TopicDetailView({ topic, onArticle }: { topic: TopicGroup; onArticle: (a: HelpArticle) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pb-1">
        {topic.articles.length} artigo{topic.articles.length !== 1 ? "s" : ""} disponíve{topic.articles.length !== 1 ? "is" : "l"}
      </p>
      {topic.articles.map((a) => (
        <button
          key={a.id}
          onClick={() => onArticle(a)}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-3
            text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{a.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.summary}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
        </button>
      ))}
    </div>
  );
}

// Guia de fluxo passo a passo numerado — para ações com múltiplas etapas
function StepGuide({ title, steps }: { title: string; steps: { icon: string; text: string }[] }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border/50 p-3 space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3 w-3" />
        {title}
      </p>
      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed flex-1">
              <span className="mr-1">{s.icon}</span>{s.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente de passo a passo de navegação
function NavigationGuide({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <div className="rounded-xl bg-muted/40 border border-border/50 p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3 w-3" />
        Como chegar lá
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {steps.map((step, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
            <span className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium",
              i === 0
                ? "bg-primary/10 text-primary"
                : i === steps.length - 1
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted text-muted-foreground",
            )}>
              {step}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Slugs que envolvem edição/exclusão de lançamentos
const EDIT_FLOW_SLUGS = new Set([
  "registrar-manutencao", "editar-lancamento", "excluir-lancamento",
  "lancamentos-manutencao", "lancamentos-uso", "lancamentos-sinistro",
  "lancamentos-acessorio", "lancamentos-nota",
]);

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

  // Tentar extrair guia de navegação do slug/módulo
  const meta = HOME_LABELS[article.slug];
  const navSteps = meta?.path ?? [];

  // Mostrar guia de edição para artigos de lançamentos
  const showEditGuide = EDIT_FLOW_SLUGS.has(article.slug) || article.module_key === "maintenance";

  return (
    <div className="space-y-3">
      {/* Trilha de navegação */}
      {navSteps.length > 0 && <NavigationGuide steps={navSteps} />}

      {/* Guia de edição/exclusão para artigos de lançamentos */}
      {showEditGuide && ctx.motorcycleId && (
        <StepGuide
          title="Como editar ou excluir um lançamento"
          steps={[
            { icon: "🏍️", text: "Acesse a tela da sua moto" },
            { icon: "📋", text: "Toque em Lançamentos no menu principal" },
            { icon: "🔍", text: "Escolha a categoria: Manutenções, Uso, Sinistros, Acessórios ou Notas" },
            { icon: "✏️", text: "Toque em Editar para corrigir o registro, ou Excluir para removê-lo" },
          ]}
        />
      )}

      {/* Conteúdo do artigo */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>

        {article.body_md && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm
            [&_strong]:font-semibold [&_ul]:pl-4 [&_li]:mt-1 [&_h2]:text-sm [&_h2]:font-semibold
            [&_h2]:mt-3 [&_p]:leading-relaxed border-t border-border/40 pt-3">
            <ReactMarkdown>{article.body_md}</ReactMarkdown>
          </div>
        )}

        {needsMoto && !isUnavailable && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              🏍️ Para continuar, selecione uma moto primeiro.
            </p>
          </div>
        )}

        {moduleStatus === "maintenance" && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              🚧 Esta funcionalidade está temporariamente em manutenção.
            </p>
          </div>
        )}

        {moduleStatus === "disabled" && (
          <div className="rounded-lg bg-muted border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground font-medium">
              Esta funcionalidade ainda não está disponível.
            </p>
          </div>
        )}

        {hasRoute && (
          <Button size="sm" className="w-full btn-glow mt-1" onClick={onCTA}>
            {needsMoto ? "🏍️ Ver minhas motos" : (article.cta_label ?? "Ir para a tela →")}
          </Button>
        )}
      </div>

      {/* Artigos relacionados */}
      {related.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Também posso ajudar com
          </p>
          {related.slice(0, 3).map((r) => (
            <button
              key={r.id}
              onClick={() => onRelated(r)}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5
                text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group"
            >
              <span className="flex-1 leading-snug">{r.title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
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
  if (loading) {
    return (
      <div className="py-10 text-center space-y-2">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground">Buscando…</p>
      </div>
    );
  }

  if (confidence === "HIGH" || confidence === "MEDIUM") {
    const article = topResult!.article;
    const needsMoto = article.needs_motorcycle && !ctx.motorcycleId;
    const isUnavailable = topResultModuleStatus === "disabled" || topResultModuleStatus === "maintenance";
    const hasRoute = !!(article.route_template || needsMoto) && !isUnavailable;
    const meta = HOME_LABELS[article.slug];
    const navSteps = meta?.path ?? [];
    const showEditGuide = EDIT_FLOW_SLUGS.has(article.slug) || article.module_key === "maintenance";

    return (
      <div className="space-y-3">
        {confidence === "MEDIUM" && (
          <p className="text-xs text-muted-foreground">Isso pode ser o que você procura?</p>
        )}

        {navSteps.length > 0 && <NavigationGuide steps={navSteps} />}

        {/* Guia de edição/exclusão para buscas relacionadas a lançamentos */}
        {showEditGuide && ctx.motorcycleId && (
          <StepGuide
            title="Como editar ou excluir um lançamento"
            steps={[
              { icon: "🏍️", text: "Acesse a tela da sua moto" },
              { icon: "📋", text: "Toque em Lançamentos no menu principal" },
              { icon: "🔍", text: "Escolha a categoria: Manutenções, Uso, Sinistros, Acessórios ou Notas" },
              { icon: "✏️", text: "Toque em Editar para corrigir o registro, ou Excluir para removê-lo" },
            ]}
          />
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
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                🚧 Esta funcionalidade está temporariamente em manutenção.
              </p>
            </div>
          )}
          {topResultModuleStatus === "disabled" && (
            <p className="text-xs text-muted-foreground font-medium">
              Esta funcionalidade ainda não está disponível.
            </p>
          )}
          {needsMoto && !isUnavailable && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                🏍️ Selecione uma moto primeiro para continuar.
              </p>
            </div>
          )}
          {hasRoute && (
            <Button size="sm" className="w-full btn-glow mt-1" onClick={() => onCTA(article)}>
              {needsMoto ? "🏍️ Ver minhas motos" : (article.cta_label ?? "Ir para a tela →")}
            </Button>
          )}
        </div>

        {/* Alternativas para MÉDIA */}
        {confidence === "MEDIUM" && results.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Outras opções</p>
            {results.slice(1).map((r) => (
              <button key={r.article.id} onClick={() => onRelated(r.article)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="flex-1">{r.article.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
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
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="flex-1">{r.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
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
        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-sm font-medium">Não encontrei uma correspondência exata.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Veja as sugestões abaixo ou navegue pelas áreas de ajuda.
          </p>
        </div>
        {results.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Talvez relacionado</p>
            {results.map((r) => (
              <button key={r.article.id} onClick={() => onRelated(r.article)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="flex-1">{r.article.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={onOpenTopics}>
            <Layers className="mr-2 h-4 w-4" /> Explorar todas as áreas
          </Button>
          <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={onOpenTicket}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Abrir chamado de suporte
          </Button>
        </div>
      </div>
    );
  }

  // ZERO
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-muted/40 border border-border p-4 text-center space-y-1.5">
        <div className="text-3xl">🤔</div>
        <p className="text-sm font-medium">Ainda não tenho uma orientação para isso.</p>
        <p className="text-xs text-muted-foreground">Registrei sua dúvida para melhorarmos o Assistente.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="w-full rounded-xl" onClick={onOpenTopics}>
          <Layers className="mr-2 h-4 w-4" /> Explorar todas as áreas de ajuda
        </Button>
        <Button className="w-full btn-glow rounded-xl" onClick={onOpenTicket}>
          <LifeBuoy className="mr-2 h-4 w-4" /> Abrir chamado de suporte
        </Button>
      </div>
    </div>
  );
}
