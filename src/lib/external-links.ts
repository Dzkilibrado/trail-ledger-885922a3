/**
 * Separação oficial App × Site Institucional (ADR 0017).
 *
 * O aplicativo e o Site Institucional são experiências independentes: nenhuma
 * navegação entre eles passa pelo roteador interno. Os links são sempre URLs
 * públicas absolutas (`https://`), formato exigido por Android App Links e
 * Apple Universal Links — quando o app estiver publicado nas lojas, basta
 * hospedar os arquivos de associação em `/.well-known/`.
 */

/** Domínio público oficial do TrailBook. */
export const TRAILBOOK_PUBLIC_ORIGIN = "https://trailbook.com.br";

/**
 * Origem pública a usar em links externos.
 * Em preview/publicado usa a própria origem (mantém o ambiente coerente);
 * fora do navegador cai no domínio oficial.
 */
export function publicOrigin(): string {
  if (typeof window === "undefined") return TRAILBOOK_PUBLIC_ORIGIN;
  const { origin, protocol } = window.location;
  if (protocol !== "http:" && protocol !== "https:") return TRAILBOOK_PUBLIC_ORIGIN;
  return origin;
}

/** URL absoluta de um caminho público. */
export function publicUrl(path: string): string {
  return `${publicOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * URL de compartilhamento — SEMPRE no domínio oficial do TrailBook.
 *
 * Diferente de `publicUrl`, nunca reflete a origem técnica do ambiente
 * (preview, homologação, hospedagem). Todo link que o usuário vê, copia,
 * envia, imprime ou transforma em QR Code deve usar esta função.
 */
export function shareUrl(path: string): string {
  return `${TRAILBOOK_PUBLIC_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Domínio oficial em formato curto, para exibição em telas e documentos. */
export const TRAILBOOK_DISPLAY_DOMAIN = "trailbook.com.br";

/** Site Institucional — "Conheça o TrailBook". */
export const siteUrl = () => publicUrl("/site");

/** Aplicativo — Tela de Boas-vindas. */
export const appUrl = () => publicUrl("/");

/** Aplicativo — criação de conta. */
export const appSignUpUrl = () => publicUrl("/auth?tab=signup");

/** Props padrão de abertura externa (navegador padrão do aparelho). */
export const externalLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
