/**
 * Utilidades compartilhadas do módulo de Recibo Inteligente.
 * Este arquivo é seguro para importar de qualquer lugar (client e server).
 */

export type ReceiptStatus = "draft" | "issued" | "signed" | "superseded" | "revoked";

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  draft: "Rascunho",
  issued: "Ativo",
  signed: "Ativo",
  superseded: "Substituído",
  revoked: "Revogado",
};

export const RECEIPT_STATUS_TONE: Record<ReceiptStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  issued: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  signed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  superseded: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  revoked: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * URL amigável de validação pública.
 * Ex.: https://trailbook.com.br/r/TB-RCV-2026-000001
 */
export function publicReceiptUrl(code: string, origin?: string): string {
  const base = (origin ?? (typeof window !== "undefined" ? window.location.origin : "https://trailbook.com.br"))
    .replace(/\/$/, "");
  return `${base}/r/${code}`;
}

export function formatIssuedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch { return iso; }
}

export function formatVersion(version: number | null | undefined): string {
  return `v${Math.max(1, Number(version ?? 1))}`;
}

export function formatCurrencyBRL(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (n == null || !Number.isFinite(n as number)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n as number);
}

/** Hash SHA-256 de bytes usando Web Crypto (browser e Worker). */
export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}