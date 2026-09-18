// ============================================================
// useAssistant — hook principal do Assistente TrailBook
// Carrega KB uma vez, faz busca local por score, sem IA paga
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

// ── Queries ───────────────────────────────────────────────────

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

  // Agrupar phrases por article_id para lookup O(1)
  const phrasesByArticle = useMemo<Record<string, HelpPhrase[]>>(() => {
    const map: Record<string, HelpPhrase[]> = {};
    for (const row of phrases.data ?? []) {
      const articleId = (row as any).help_intents?.article_id;
      if (!articleId) continue;
      if (!map[articleId]) map[articleId] = [];
      map[articleId].push({ id: row.id, intent_id: row.intent_id, phrase: row.phrase, weight: row.weight, created_at: row.created_at });
    }
    return map;
  }, [phrases.data]);

  return { articles: articles.data ?? [], phrasesByArticle, loading: articles.isLoading || phrases.isLoading };
}

// ── Sugestões contextuais ─────────────────────────────────────

function contextualSuggestions(articles: HelpArticle[], ctx: AssistantContext): HelpArticle[] {
  return articles
    .filter((a) => a.context_tags?.includes(ctx.moduleKey))
    .slice(0, 3);
}

// ── Hook principal ────────────────────────────────────────────

export function useAssistant(ctx: AssistantContext) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<string[]>([]);

  const { articles, phrasesByArticle, loading } = useAssistantKB();

  const results: SearchResult[] = useMemo(() => {
    if (!submitted || !query.trim() || loading) return [];
    return searchHelp(query, articles, phrasesByArticle);
  }, [submitted, query, articles, phrasesByArticle, loading]);

  const topResult = results[0] ?? null;
  const confidence = topResult?.confidence ?? "ZERO";

  const suggestions = useMemo(
    () => contextualSuggestions(articles, ctx),
    [articles, ctx],
  );

  const submitQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmitted(true);
    setSessionHistory((h) => [trimmed, ...h.slice(0, 9)]);
  }, []);

  const resetSearch = useCallback(() => {
    setQuery("");
    setSubmitted(false);
  }, []);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => {
    setOpen(false);
    resetSearch();
  }, [resetSearch]);

  // Registrar dúvida não respondida via RPC (somente ZERO, somente após submit)
  const recordUnanswered = useCallback(async () => {
    if (!submitted || !query.trim() || confidence !== "ZERO") return;
    try {
      await (supabase as any).rpc("record_help_unanswered", {
        _query_text: query.trim(),
        _route: ctx.pathname,
        _module_key: ctx.moduleKey,
      });
    } catch (_) {
      // silencioso — não bloquear UX por falha de telemetria
    }
  }, [submitted, query, confidence, ctx]);

  return {
    open, openDrawer, closeDrawer,
    query, setQuery,
    submitted, submitQuery, resetSearch,
    results, topResult, confidence,
    suggestions,
    loading,
    sessionHistory,
    recordUnanswered,
  };
}
