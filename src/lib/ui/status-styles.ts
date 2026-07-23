// Fonte única dos estilos visuais de status/prioridade/tier do TrailBook.
// Sprint v1.6 — Bloco C (consolidação).
//
// Antes desta consolidação, sete arquivos declaravam dicionários
// (STATUS_TONE, PRIORITY_TONE, TIER_STYLE) com as mesmas paletas repetidas.
// Agora todos referenciam as constantes daqui, garantindo cor uniforme
// em toda a interface. A saída em classes é idêntica à anterior.

/** Paleta canônica de "tons" para chips/badges (border + bg + text). */
export const TONE = {
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/30",
  sky: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
} as const;

/**
 * Estilos de tier para os selos v2 (Central de Selos, Passaporte).
 * Refinamento v1.7: fundo neutro + fio de acento sutil por tier, para leitura
 * calma e premium — evita a saturação laranja/âmbar percebida antes.
 */
export const BADGE_TIER_STYLE = {
  bronze: "border-amber-500/30 bg-card text-amber-200/90",
  silver: "border-slate-300/25 bg-card text-slate-100",
  gold: "border-yellow-400/35 bg-card text-yellow-100",
  signature: "border-fuchsia-300/40 bg-gradient-to-r from-fuchsia-500/15 to-cyan-400/15 text-white",
} as const;

/**
 * Escala visual do Passaporte (índice de conservação convertido em tier).
 * NÃO é a mesma escala dos selos v2 (BADGE_TIER_STYLE) — é uma "pílula"
 * de score da moto, com tiers "none/bronze/silver/gold/platinum/diamond".
 */
export const SCORE_TIER_STYLE: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  bronze: "bg-amber-900/30 text-amber-300 border border-amber-600/40",
  silver: "bg-slate-500/20 text-slate-200 border border-slate-400/40",
  gold: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50",
  platinum: "bg-cyan-400/20 text-cyan-100 border border-cyan-300/60",
  diamond: "bg-gradient-to-r from-fuchsia-500/30 to-cyan-400/30 text-white border border-fuchsia-300/60",
};