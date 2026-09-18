// ============================================================
// useAssistant — hook principal do Assistente TrailBook
// Carrega KB uma vez, faz busca local por score, sem IA paga
// Module-aware: filtra sugestões por status real dos platform_modules
// ============================================================

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  searchHelp,
  type SearchResult,
  type HelpArticle,
  type HelpPhrase,
} from "@/lib/assistant-search";
import type { AssistantContext } from "@/lib/assistant-context";
import { useModules } from "@/hooks/useModules";
import { isModuleEligible, getArticleModuleStatus } from "@/lib/assistant-module-map";
import type { ModuleStatus } from "@/lib/modules";

// ── Queries KB ────────────────────────────────────────────────

function useAssistantKB() {
  const articles = useQuery({
    queryKey: ["assistant_articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HelpArticle[];
    },
    staleTime: 5 * 60_000,
  });

  const phrases = useQuery({
    queryKey: ["assistant_phrases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_intent_phrases")
        .select("*, help_intents!inner(article_id)");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const phrasesByArticle = useMemo<Record<string, HelpPhrase[]>>(() => {
    const map: Record<string, HelpPhrase[]> = {};
    for (const row of phrases.data ?? []) {
      const articleId = (row as any).help_intents?.article_id;
      if (!articleId) continue;
      if (!map[articleId]) map[articleId] = [];
      map[articleId].push({
        id: row.id, intent_id: row.intent_id,
        phrase: row.phrase, weight: row.weight, created_at: row.created_at,
      });
    }
    return map;
  }, [phrases.data]);

  return { articles: articles.data ?? [], phrasesByArticle, loading: articles.isLoading || phrases.isLoading };
}

// ── Module status map ─────────────────────────────────────────

function useModuleStatuses(): Record<string, ModuleStatus> {
  const { data: modules } = useModules();
  return useMemo(() => {
    const map: Record<string, ModuleStatus> = {};
    for (const m of modules ?? []) {
      map[m.key] = m.status as ModuleStatus;
    }
    return map;
  }, [modules]);
}

// ── Tópicos ───────────────────────────────────────────────────

export interface TopicGroup {
  key: string;
  label: string;
  icon: string;
  articles: HelpArticle[];
}

const TOPIC_CONFIG: Array<{ key: string; label: string; icon: string; order: number }> = [
  { key: "motorcycle",   label: "Minha moto",           icon: "Bike",        order: 1 },
  { key: "maintenance",  label: "Manutenção",            icon: "Wrench",      order: 2 },
  { key: "passport",     label: "Passaporte Digital",    icon: "FileCheck",   order: 3 },
  { key: "health",       label: "Saúde da moto",         icon: "HeartPulse",  order: 4 },
  { key: "certificate",  label: "Selos e certificados",  icon: "BadgeCheck",  order: 5 },
  { key: "fiscal",       label: "Fiscalização e laudo",  icon: "ShieldCheck", order: 6 },
  { key: "profile",      label: "Conta e perfil",        icon: "User",        order: 7 },
  { key: "support",      label: "Suporte",               icon: "LifeBuoy",    order: 8 },
  { key: "agenda",       label: "Agenda",                icon: "Calendar",    order: 9 },
  { key: "financial",    label: "Financeiro",            icon: "Banknote",    order: 10 },
];

// 6 slugs candidatos à Home — filtrados por elegibilidade de módulo
const HOME_SLUG_CANDIDATES = [
  "cadastrar-moto",
  "registrar-manutencao",
  "plano-manutencao",
  "passaporte-digital",
  "health-avaliacao",
  "modo-fiscalizacao",
  "selos-qualidade",
  "meus-itens",
  "abrir-chamado",
];

// Máximo de sugestões na Home
const MAX_HOME_SUGGESTIONS = 6;

// ── Sugestões contextuais ─────────────────────────────────────

function contextualSuggestions(
  articles: HelpArticle[],
  ctx: AssistantContext,
  moduleStatuses: Record<string, ModuleStatus>,
): HelpArticle[] {
  const eligible = articles.filter((a) => isModuleEligible(a.module_key, moduleStatuses));
  const byModule = eligible.filter((a) => a.module_key === ctx.moduleKey);
  const byTags   = eligible.filter(
    (a) => a.context_tags?.some((t) => t === ctx.moduleKey) && !byModule.includes(a),
  );
  return [...byModule, ...byTags].slice(0, 4);
}

// ── Artigos relacionados ──────────────────────────────────────

function relatedArticles(
  topResult: SearchResult | null,
  articles: HelpArticle[],
  moduleStatuses: Record<string, ModuleStatus>,
): HelpArticle[] {
  if (!topResult) return [];
  const moduleKey = topResult.article.module_key;
  return articles
    .filter(
      (a) =>
        a.id !== topResult.article.id &&
        a.module_key === moduleKey &&
        isModuleEligible(a.module_key, moduleStatuses),
    )
    .slice(0, 3);
}

// ── DrawerView ────────────────────────────────────────────────

export type DrawerView =
  | "home"
  | "topics"
  | "topic-detail"
  | "article"
  | "search";

// ── Hook principal ────────────────────────────────────────────

export function useAssistant(ctx: AssistantContext) {
  const [open, setOpen]                           = useState(false);
  const [query, setQuery]                         = useState("");
  const [submitted, setSubmitted]                 = useState(false);
  const [view, setView]                           = useState<DrawerView>("home");
  const [selectedTopic, setSelectedTopic]         = useState<TopicGroup | null>(null);
  const [selectedArticle, setSelectedArticle]     = useState<HelpArticle | null>(null);
  const [sessionHistory, setSessionHistory]       = useState<string[]>([]);

  const { articles, phrasesByArticle, loading } = useAssistantKB();
  const moduleStatuses = useModuleStatuses();

  // Home: candidatos filtrados por elegibilidade, até MAX_HOME_SUGGESTIONS
  const homeSuggestions = useMemo<HelpArticle[]>(() => {
    if (!articles.length) return [];
    return HOME_SLUG_CANDIDATES
      .map((slug) => articles.find((a) => a.slug === slug))
      .filter((a): a is HelpArticle => !!a && isModuleEligible(a.module_key, moduleStatuses))
      .slice(0, MAX_HOME_SUGGESTIONS);
  }, [articles, moduleStatuses]);

  // Tópicos: apenas grupos com pelo menos 1 artigo elegível
  const topicGroups = useMemo<TopicGroup[]>(() => {
    return TOPIC_CONFIG
      .map((cfg) => ({
        key: cfg.key,
        label: cfg.label,
        icon: cfg.icon,
        articles: articles.filter(
          (a) => a.module_key === cfg.key && isModuleEligible(a.module_key, moduleStatuses),
        ),
      }))
      .filter((g) => g.articles.length > 0)
      .sort((a, b) => {
        const oa = TOPIC_CONFIG.find((c) => c.key === a.key)?.order ?? 99;
        const ob = TOPIC_CONFIG.find((c) => c.key === b.key)?.order ?? 99;
        return oa - ob;
      });
  }, [articles, moduleStatuses]);

  // Sugestões contextuais
  const suggestions = useMemo(
    () => contextualSuggestions(articles, ctx, moduleStatuses),
    [articles, ctx, moduleStatuses],
  );

  // Resultados de busca — TODOS os artigos (eligible ou não) para busca explícita
  // O status de elegibilidade é exposto no resultado para o UI decidir o CTA
  const results: SearchResult[] = useMemo(() => {
    if (!submitted || !query.trim() || loading) return [];
    return searchHelp(query, articles, phrasesByArticle);
  }, [submitted, query, articles, phrasesByArticle, loading]);

  const topResult = results[0] ?? null;
  const confidence = topResult?.confidence ?? "ZERO";

  // Status do módulo do resultado encontrado (para CTA aware)
  const topResultModuleStatus = useMemo(
    () => topResult ? getArticleModuleStatus(topResult.article.module_key, moduleStatuses) : null,
    [topResult, moduleStatuses],
  );

  const related = useMemo(
    () => relatedArticles(topResult, articles, moduleStatuses),
    [topResult, articles, moduleStatuses],
  );

  // Navegação
  const openDrawer = useCallback(() => {
    setOpen(true); setView("home");
    setSelectedTopic(null); setSelectedArticle(null);
  }, []);

  const closeDrawer = useCallback(() => {
    setOpen(false); setView("home");
    setQuery(""); setSubmitted(false);
    setSelectedTopic(null); setSelectedArticle(null);
  }, []);

  const goHome = useCallback(() => {
    setView("home"); setQuery(""); setSubmitted(false);
    setSelectedTopic(null); setSelectedArticle(null);
  }, []);

  const openTopics  = useCallback(() => setView("topics"), []);

  const openTopic   = useCallback((topic: TopicGroup) => {
    setSelectedTopic(topic); setView("topic-detail");
  }, []);

  const openArticle = useCallback((article: HelpArticle) => {
    setSelectedArticle(article); setView("article");
  }, []);

  const goBack = useCallback(() => {
    if (view === "article" && selectedTopic) { setView("topic-detail"); setSelectedArticle(null); return; }
    if (view === "article")     { setView("home"); setSelectedArticle(null); return; }
    if (view === "topic-detail"){ setView("topics"); setSelectedTopic(null); return; }
    if (view === "topics")      { setView("home"); return; }
    if (view === "search")      { setView("home"); setQuery(""); setSubmitted(false); return; }
    setView("home");
  }, [view, selectedTopic]);

  const submitQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed); setSubmitted(true); setView("search");
    setSessionHistory((h) => [trimmed, ...h.slice(0, 9)]);
  }, []);

  const resetSearch = useCallback(() => {
    setQuery(""); setSubmitted(false); setView("home");
  }, []);

  // record_help_unanswered: ZERO genuíno — não chamar se artigo existe mas inelegível
  const recordUnanswered = useCallback(async () => {
    if (!submitted || !query.trim() || confidence !== "ZERO") return;
    // Não registrar se havia artigos mas foram filtrados por elegibilidade
    // (o conteúdo existe, o módulo é que está indisponível)
    const anyIneligibleMatch = searchHelp(query, articles, phrasesByArticle).length > 0;
    if (anyIneligibleMatch) return; // artigo existe — não é dúvida sem resposta
    try {
      await (supabase as any).rpc("record_help_unanswered", {
        _query_text: query.trim(),
        _route: ctx.pathname,
        _module_key: ctx.moduleKey,
      });
    } catch (_) {}
  }, [submitted, query, confidence, ctx, articles, phrasesByArticle]);

  // Verificar elegibilidade de um artigo específico
  const isArticleEligible = useCallback(
    (article: HelpArticle) => isModuleEligible(article.module_key, moduleStatuses),
    [moduleStatuses],
  );

  const getModuleStatus = useCallback(
    (article: HelpArticle) => getArticleModuleStatus(article.module_key, moduleStatuses),
    [moduleStatuses],
  );

  return {
    open, openDrawer, closeDrawer,
    view, goHome, openTopics, openTopic, openArticle, goBack,
    selectedTopic, selectedArticle,
    query, setQuery,
    submitted, submitQuery, resetSearch,
    results, topResult, confidence, related,
    topResultModuleStatus,
    homeSuggestions, topicGroups, suggestions,
    loading,
    sessionHistory,
    recordUnanswered,
    isArticleEligible,
    getModuleStatus,
    moduleStatuses,
  };
}
