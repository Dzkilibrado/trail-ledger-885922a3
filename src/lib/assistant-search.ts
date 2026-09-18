// ============================================================
// Assistant Search — busca por score sem IA (Fase 1)
// Algoritmo: tokenização + overlap + prefix match + pesos
// ============================================================

import type { Database } from "@/integrations/supabase/types";

export type HelpArticle   = Database["public"]["Tables"]["help_articles"]["Row"];
export type HelpIntent    = Database["public"]["Tables"]["help_intents"]["Row"];
export type HelpPhrase    = Database["public"]["Tables"]["help_intent_phrases"]["Row"];

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "ZERO";

export interface SearchResult {
  article: HelpArticle;
  score: number;
  confidence: ConfidenceLevel;
}

// Calibráveis sem alterar lógica
export const CONFIDENCE_THRESHOLDS = {
  HIGH:   6.0,
  MEDIUM: 3.0,
  LOW:    1.0,
} as const;

const STOPWORDS_PT = new Set([
  "de","da","do","em","um","uma","com","por","para","que","como",
  "quando","onde","qual","quais","meu","minha","meus","minhas",
  "o","a","os","as","e","ou","se","na","no","nos","nas","ao","aos",
  "eu","tu","ele","ela","nos","vos","eles","elas","me","te","lhe",
  "mim","ti","si","isso","isto","aqui","ai","la","ja","nao","sim",
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remover diacríticos
    .replace(/[^a-z0-9\s]/g, " ")      // pontuação → espaço
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS_PT.has(t));
}

function tokenMatch(query: string, target: string): boolean {
  // Exact match ou prefix match (mín 4 chars)
  return query === target || (query.length >= 4 && target.startsWith(query));
}

export function scoreArticle(
  queryTokens: string[],
  article: HelpArticle,
  phrases: HelpPhrase[],
): number {
  if (queryTokens.length === 0) return 0;

  let score = 0;
  const titleTokens   = tokenize(article.title);
  const summaryTokens = tokenize(article.summary);

  // A. Overlap com título (peso 3)
  for (const qt of queryTokens) {
    if (titleTokens.some((tt) => tokenMatch(qt, tt))) score += 3;
  }

  // B. Overlap com summary (peso 1)
  for (const qt of queryTokens) {
    if (summaryTokens.some((st) => tokenMatch(qt, st))) score += 1;
  }

  // C. Overlap com phrases (peso phrase.weight × overlap_ratio × 4)
  for (const p of phrases) {
    const pt = tokenize(p.phrase);
    if (pt.length === 0) continue;
    const overlap = queryTokens.filter((qt) =>
      pt.some((t) => tokenMatch(qt, t))
    ).length;
    const ratio = overlap / Math.max(queryTokens.length, pt.length);
    if (ratio > 0) score += ratio * p.weight * 4;
  }

  // D. Bônus: query normalizada contida em title/summary
  const qNorm = normalizeText(queryTokens.join(" "));
  if (normalizeText(article.title).includes(qNorm))   score += 5;
  if (normalizeText(article.summary).includes(qNorm)) score += 2;

  return Math.round(score * 10) / 10;
}

export function confidenceOf(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH)   return "HIGH";
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return "MEDIUM";
  if (score >= CONFIDENCE_THRESHOLDS.LOW)    return "LOW";
  return "ZERO";
}

export function searchHelp(
  query: string,
  articles: HelpArticle[],
  intentsByArticle: Record<string, HelpPhrase[]>,
): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  return articles
    .filter((a) => a.status === "published")
    .map((article) => {
      const phrases = intentsByArticle[article.id] ?? [];
      const score = scoreArticle(queryTokens, article, phrases);
      return { article, score, confidence: confidenceOf(score) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
