import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Info, Search, Stethoscope, Wrench } from "lucide-react";
import { EvaluationPill } from "./EvaluationPill";
import {
  EVALUATION_TEXT,
  buildEvaluation,
  type EvaluationState,
} from "@/lib/ui/evaluation";
import type { RideAnswer } from "@/lib/til/ride-answer";

const ICON: Record<EvaluationState, React.ComponentType<{ className?: string }>> = {
  no_data: HelpCircle,
  healthy: CheckCircle2,
  attention: Clock,
  review: Wrench,
  action: AlertTriangle,
};

/**
 * Estrutura oficial de avaliação do TrailBook (v4.0):
 * 1) O TrailBook avaliou a motocicleta
 * 2) Diagnóstico
 * 3) O que encontramos
 * 4) O que recomendamos
 * 5) Posso rodar hoje?
 */
export function EvaluationCard({
  answer,
  actions,
  compact = false,
}: {
  answer: RideAnswer;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  const ev = buildEvaluation(answer);
  const Icon = ICON[ev.state];

  return (
    <section
      aria-label="Avaliação da motocicleta"
      className={compact ? "surface-elevated space-y-3 rounded-2xl px-4 py-4" : "surface-elevated space-y-4 rounded-3xl px-5 py-6"}
    >
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Avaliação da motocicleta</p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{ev.intro}</p>
      </div>

      <div className="flex items-start justify-between gap-3">
        <h2 className={`flex min-w-0 items-center gap-2 font-display font-bold ${compact ? "text-base" : "text-xl"} ${EVALUATION_TEXT[ev.state]}`}>
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="min-w-0">{ev.label}</span>
        </h2>
        <EvaluationPill state={ev.state} size={compact ? "sm" : "md"} className="shrink-0" />
      </div>

      <Block icon={Search} title="O que encontramos durante a avaliação?">
        <ul className="space-y-1">
          {ev.findings.map((f, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span aria-hidden className="text-muted-foreground">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block icon={Stethoscope} title="O que recomendamos fazer agora?">
        <p className="text-sm">{ev.recommendation}</p>
      </Block>

      <div className="rounded-2xl bg-muted/50 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Posso rodar hoje?</p>
        <p className={`mt-0.5 text-sm font-semibold ${EVALUATION_TEXT[ev.state]}`}>{ev.verdict}</p>
      </div>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>{ev.disclaimer}</span>
      </p>
    </section>
  );
}

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {title}
      </p>
      {children}
    </div>
  );
}
