import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onClick: () => void;
  moduleStatus: string;  // active | beta | maintenance | disabled
}

export function AssistantButton({ onClick, moduleStatus }: Props) {
  if (moduleStatus === "disabled") return null;

  return (
    <button
      onClick={onClick}
      aria-label="Assistente TrailBook"
      className={cn(
        // Posicionamento: acima do BottomNav mobile, direita, sem cobrir CTA
        "assistant-fab",
        "fixed right-4 z-40",
        // Tamanho e forma
        "flex h-12 w-12 items-center justify-center rounded-full shadow-lg",
        // Cor e hover
        "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform",
        // md+: BottomNav some → ajustar posição
        "bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] md:bottom-6",
      )}
    >
      <Sparkles className="h-5 w-5" aria-hidden="true" />
      {moduleStatus === "beta" && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-black leading-none">
          β
        </span>
      )}
    </button>
  );
}
