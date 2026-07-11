/**
 * Estado documental de origem — helpers de leitura e "Lembrar mais tarde".
 *
 * O silêncio é local (localStorage) por usuário + moto, com prazo de 7 dias.
 * Não persiste no banco. Anexar um documento de origem válido limpa o silêncio
 * automaticamente (via `clearOriginSnooze`).
 */

import type { PendencyRow } from "@/hooks/useDocumentPendencies";

const SNOOZE_PREFIX = "trailbook:origin-snooze:";
const SNOOZE_DAYS = 7;

function key(userId: string, motoId: string) {
  return `${SNOOZE_PREFIX}${userId}:${motoId}`;
}

/** Retorna `true` quando a pendência foi silenciada e ainda não expirou. */
export function isOriginSnoozed(userId: string | null, motoId: string): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(key(userId, motoId));
    if (!raw) return false;
    const until = Number.parseInt(raw, 10);
    if (!Number.isFinite(until)) return false;
    if (Date.now() >= until) {
      window.localStorage.removeItem(key(userId, motoId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Silencia a pendência por `days` dias (padrão 7). */
export function snoozeOriginPendency(userId: string | null, motoId: string, days = SNOOZE_DAYS) {
  if (!userId || typeof window === "undefined") return;
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(key(userId, motoId), String(until));
  } catch {
    /* storage indisponível — ignora, não é bloqueante */
  }
}

/** Remove o silêncio local — deve ser chamado ao anexar documento de origem. */
export function clearOriginSnooze(userId: string | null, motoId: string) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(userId, motoId));
  } catch {
    /* noop */
  }
}

/** Origem comprovada = existe row na view e a pendência foi resolvida. */
export function isOriginProven(pendency: PendencyRow | null | undefined): boolean {
  if (!pendency) return false;
  return !!pendency.origin_type && pendency.has_origin_pendency === false;
}

/**
 * Tipos aceitos para comprovar origem. A pendência é considerada resolvida
 * quando qualquer um deles for anexado como documento atual e ativo.
 */
export const ORIGIN_DOC_TYPES = ["invoice", "bill_of_sale"] as const;
export type OriginDocType = (typeof ORIGIN_DOC_TYPES)[number];

/** Sugestão de tipo pré-selecionado no upload, conforme origem declarada. */
export function suggestOriginDocType(originType: string | null | undefined): OriginDocType {
  return originType === "zero_km" ? "invoice" : "bill_of_sale";
}