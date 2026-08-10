import type { AnchorHTMLAttributes, ReactNode } from "react";
import { openExternal } from "@/lib/open-external";

/**
 * Substitui `<a href={url} {...externalLinkProps}>` para links que devem
 * abrir fora da navegação interna do app (site institucional, cadastro,
 * etc.) — ver comentário em `openExternal` para o motivo.
 *
 * Mantém `href` (acessibilidade, abrir em nova aba com o botão do meio,
 * menu de contexto "copiar link") e apenas intercepta o clique padrão para
 * decidir a melhor forma de abrir conforme o ambiente.
 */
export function ExternalLink({
  href,
  children,
  className,
  ...rest
}: { href: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "target" | "rel" | "onClick"
>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        openExternal(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
