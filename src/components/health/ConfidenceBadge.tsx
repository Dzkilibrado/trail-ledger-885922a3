import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield } from "lucide-react";
import {
  CONFIDENCE_DESCRIPTION,
  CONFIDENCE_SHORT,
  CONFIDENCE_TEXT_CLASS,
  type ConfidenceAssessment,
  type ConfidenceLevel,
} from "@/lib/til/confidence";

const ICON: Record<ConfidenceLevel, React.ComponentType<{ className?: string }>> = {
  high: ShieldCheck,
  medium: Shield,
  low: ShieldAlert,
  not_evaluable: ShieldQuestion,
};

/**
 * Confiabilidade da análise — NÃO é estado de conservação.
 * Nunca exibe percentual isolado: sempre nível + motivo + como melhorar.
 */
export function ConfidenceBadge({ confidence }: { confidence: ConfidenceAssessment }) {
  const Icon = ICON[confidence.level];
  return (
    <section
      aria-label="Confiabilidade da análise"
      className="rounded-2xl border border-border bg-muted/30 p-3.5"
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${CONFIDENCE_TEXT_CLASS[confidence.level]}`} aria-hidden />
        <h3 className="text-sm font-semibold">
          Confiabilidade da análise:{" "}
          <span className={CONFIDENCE_TEXT_CLASS[confidence.level]}>{CONFIDENCE_SHORT[confidence.level]}</span>
        </h3>
      </div>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        {CONFIDENCE_DESCRIPTION[confidence.level]} {confidence.reason}
      </p>

      {confidence.used.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dados utilizados
          </p>
          <ul className="mt-1 space-y-0.5">
            {confidence.used.map((d) => (
              <li key={d.key} className="text-xs text-foreground/80">• {d.label}</li>
            ))}
          </ul>
        </div>
      )}

      {confidence.missing.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dados que melhorariam a análise
          </p>
          <ul className="mt-1 space-y-0.5">
            {confidence.missing.map((d) => (
              <li key={d.key} className="text-xs text-muted-foreground">• {d.label}</li>
            ))}
          </ul>
        </div>
      )}

      {confidence.bestNextAction && (
        <p className="mt-3 rounded-xl bg-card px-3 py-2 text-xs font-medium">
          Para aumentar a confiabilidade: {confidence.bestNextAction}.
        </p>
      )}
    </section>
  );
}
