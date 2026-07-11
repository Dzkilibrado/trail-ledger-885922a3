import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Ajuda contextual acessível por toque e por hover.
 * Usa Popover (funciona em mobile) em vez de Tooltip puro.
 */
export function HelpTooltip({
  label,
  text,
  className,
}: {
  label?: string;
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ? `Ajuda: ${label}` : "Ajuda"}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="max-w-[280px] text-xs leading-snug">
        {label && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>}
        <p className="text-foreground/90">{text}</p>
      </PopoverContent>
    </Popover>
  );
}