import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewStateSnapshot } from "@/lib/review-state";

const TONE: Record<ReviewStateSnapshot["tone"], string> = {
  info: "border-primary/20 bg-primary/5 text-primary/90",
  attention: "border-amber-500/20 bg-amber-500/5 text-amber-200",
  good: "border-emerald-500/20 bg-emerald-500/5 text-emerald-200",
};

/**
 * Faixa informativa discreta para o Painel de Saúde e Agenda.
 * Deixa claro que os indicadores partem da baseline informada.
 * Nenhum efeito sobre notas, vencimentos ou alarmes.
 */
export function ReviewStateNotice({
  snapshot,
  compact = false,
  className,
}: {
  snapshot: ReviewStateSnapshot;
  compact?: boolean;
  className?: string;
}) {
  const text = compact
    ? "Indicadores calculados utilizando baseline informada no cadastro."
    : snapshot.message;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs leading-relaxed",
        TONE[snapshot.tone],
        className,
      )}
      role="note"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <p className="min-w-0">{text}</p>
    </div>
  );
}