/**
 * TrailBook Health — linguagem universal de status.
 *
 * Regra oficial: o usuário NUNCA interpreta números.
 * Toda tela do TrailBook comunica estado através destes quatro status.
 *
 *   🟢 OK                   → nada a fazer agora
 *   🟡 Atenção              → planejar, ainda pode rodar
 *   🔴 Necessita ação       → resolver antes de rodar
 *   ⚪ Dados insuficientes  → falta informação para diagnosticar
 */

export type HealthStatus = "ok" | "attention" | "action" | "unknown";

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  ok: "OK",
  attention: "Atenção",
  action: "Necessita ação",
  unknown: "Dados insuficientes",
};

/** Frase curta que responde "o que isso significa para mim?". */
export const HEALTH_STATUS_MEANING: Record<HealthStatus, string> = {
  ok: "Nada a fazer agora",
  attention: "Pode rodar, mas programe a manutenção",
  action: "Resolva antes de rodar",
  unknown: "Informe os dados para diagnosticar",
};

export const HEALTH_STATUS_DOT: Record<HealthStatus, string> = {
  ok: "bg-emerald-500",
  attention: "bg-amber-400",
  action: "bg-destructive",
  unknown: "bg-muted-foreground",
};

export const HEALTH_STATUS_TEXT: Record<HealthStatus, string> = {
  ok: "text-emerald-500",
  attention: "text-amber-400",
  action: "text-destructive",
  unknown: "text-muted-foreground",
};

export const HEALTH_STATUS_SOFT: Record<HealthStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
  attention: "bg-amber-500/10 text-amber-400 ring-amber-400/25",
  action: "bg-destructive/10 text-destructive ring-destructive/25",
  unknown: "bg-muted text-muted-foreground ring-border",
};

/** Ordem de prioridade: quanto menor, mais urgente. */
export const HEALTH_STATUS_WEIGHT: Record<HealthStatus, number> = {
  action: 0,
  attention: 1,
  unknown: 2,
  ok: 3,
};

/** Pior status de um conjunto (ignora "unknown" quando há sinal real). */
export function worstStatus(list: HealthStatus[]): HealthStatus {
  if (list.includes("action")) return "action";
  if (list.includes("attention")) return "attention";
  if (list.length > 0 && list.every((s) => s === "unknown")) return "unknown";
  return "ok";
}
