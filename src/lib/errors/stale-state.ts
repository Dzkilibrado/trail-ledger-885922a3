/**
 * Erro com Recuperação — sentinel e mensagens amigáveis para conflitos de
 * estado / concorrência / RLS "0 linhas".
 *
 * Princípio permanente (ADR 0012): quando o backend detectar que o estado
 * mudou entre o momento em que o usuário viu a tela e a operação chegou ao
 * servidor, ele deve lançar um erro prefixado com `STALE_STATE:`. O
 * frontend detecta esse prefixo, faz o refetch (sincroniza a UI) e só
 * então exibe uma mensagem amigável — sem exigir refresh manual.
 */

export const STALE_STATE_PREFIX = "STALE_STATE:";

/** Marca uma mensagem como erro recuperável de estado desatualizado. */
export function staleStateError(message: string): Error {
  return new Error(`${STALE_STATE_PREFIX} ${message}`);
}

/** True quando o erro veio marcado como estado desatualizado. */
export function isStaleStateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.startsWith(STALE_STATE_PREFIX);
}

/** Mensagem padrão amigável para o usuário após sincronia automática. */
export function staleStateUserMessage(operation?: string): string {
  const op = operation ? ` durante "${operation}"` : "";
  return `As informações mudaram${op}. Atualizamos a tela para você — revise o status e tente novamente, se necessário.`;
}

/** Remove o prefixo interno da mensagem (para log/debug). */
export function stripStaleStatePrefix(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.startsWith(STALE_STATE_PREFIX) ? msg.slice(STALE_STATE_PREFIX.length).trim() : msg;
}