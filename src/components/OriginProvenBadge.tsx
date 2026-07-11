import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicador positivo "🟢 Origem comprovada".
 * Aparece quando a motocicleta possui documento de origem válido anexado.
 * Substitui o alerta de pendência em todos os módulos onde a documentação
 * é apresentada (Central da Moto, Passaporte, Saúde, Documentos, etc.).
 */
export function OriginProvenBadge({
  variant = "chip",
  className,
}: {
  /** `chip` — pílula compacta; `card` — bloco com descrição. */
  variant?: "chip" | "card";
  className?: string;
}) {
  if (variant === "chip") {
    return (
      <span
        title="Documento de origem válido anexado ao histórico permanente."
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300",
          className,
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Origem comprovada
      </span>
    );
  }
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs",
        className,
      )}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-emerald-200">🟢 Origem comprovada</div>
        <p className="mt-0.5 text-emerald-100/80">
          A origem desta motocicleta foi comprovada por meio de documentação válida e agora
          faz parte do histórico permanente do TrailBook.
        </p>
      </div>
    </div>
  );
}