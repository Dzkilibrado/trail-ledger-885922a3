import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NO_DATA_HELP_INTRO, NO_DATA_HELP_STEPS, NO_DATA_HELP_TITLE } from "@/lib/til/messages";

/**
 * Estado ⚪ "Ainda não avaliado" — nunca deve parecer erro do sistema.
 * Explica exatamente quais dados faltam e leva ao formulário correto.
 */
export function NoDataHelp({
  componentName,
  onComplete,
}: {
  componentName: string;
  onComplete?: () => void;
}) {
  return (
    <section
      aria-label="Componente ainda não avaliado"
      className="rounded-2xl border border-border bg-muted/30 p-4"
    >
      <div className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">⚪ {NO_DATA_HELP_TITLE}</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{NO_DATA_HELP_INTRO(componentName)}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Para gerar um diagnóstico
      </p>
      <ul className="mt-1 space-y-0.5">
        {NO_DATA_HELP_STEPS.map((step) => (
          <li key={step} className="text-xs text-foreground/80">• {step}</li>
        ))}
      </ul>
      {onComplete && (
        <Button className="mt-3 w-full" variant="outline" onClick={onComplete}>
          Completar informações
        </Button>
      )}
    </section>
  );
}
