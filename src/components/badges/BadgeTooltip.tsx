import { CheckCircle2, Circle } from "lucide-react";
import type { BadgeEvaluation } from "@/lib/badges";
import { cn } from "@/lib/utils";

/** Conteúdo do tooltip: significado + critérios atendidos/pendentes. */
export function BadgeTooltipContent({ evaluation }: { evaluation: BadgeEvaluation }) {
  const b = evaluation.definition;
  return (
    <div className="max-w-xs space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{b.glyph}</span>
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{b.title}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {STATE_LABEL[evaluation.state]}
          </div>
        </div>
      </div>
      <p className="text-muted-foreground">{b.description}</p>
      <ul className="space-y-1">
        {evaluation.criteria.map((c, i) => (
          <li key={i} className="flex items-start gap-1.5">
            {c.state === "met" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
            ) : c.state === "n/a" ? (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
            ) : (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
            )}
            <div className="min-w-0">
              <div className={cn(
                c.state === "met" ? "text-foreground" : "text-muted-foreground",
              )}>{c.label}</div>
              {c.hint && <div className="text-[10px] text-muted-foreground/70">{c.hint}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATE_LABEL = {
  earned: "Conquistado",
  partial: "Em progresso",
  locked: "Ainda não conquistado",
} as const;