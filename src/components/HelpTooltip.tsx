import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Ajuda contextual acessível por toque e por hover.
 * Padrão oficial de UX do TrailBook (ADR 0009): compreensão em até um toque.
 *
 * Regras aplicadas:
 *  - Abre por toque no Mobile (Popover, não Tooltip puro).
 *  - Nunca ocupa a tela inteira; texto curto e amigável.
 *  - Permanece dentro da viewport (collisionPadding=8).
 *  - Fecha com toque fora, Esc ou novo toque no ícone.
 *  - Respeita modo claro/escuro e foco visível para acessibilidade.
 */
export function HelpTooltip({
  label,
  text,
  className,
  side = "top",
}: {
  label?: string;
  text: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ? `Ajuda: ${label}` : "Ajuda"}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="z-50 w-[min(18rem,calc(100vw-1rem))] text-xs leading-relaxed"
      >
        {label && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        )}
        <p className="text-foreground/90">{text}</p>
      </PopoverContent>
    </Popover>
  );
}