import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Info } from "lucide-react";
import { TBStatusPill } from "@/design-system/primitives/TBStatusPill";
import { HEALTH_STATUS_TEXT, type HealthStatus } from "@/lib/til/status";
import type { RideAnswer } from "@/lib/til/ride-answer";

const ICON: Record<HealthStatus, React.ComponentType<{ className?: string }>> = {
  ok: CheckCircle2,
  attention: Clock,
  action: AlertTriangle,
  unknown: HelpCircle,
};

/**
 * Card de Saúde Geral + resposta "Posso rodar hoje?".
 * Nunca destaca nota percentual: status, mensagem, justificativa,
 * contagens, próxima ação e ressalva responsável.
 */
export function RideAnswerCard({
  answer,
  actions,
}: {
  answer: RideAnswer;
  actions?: React.ReactNode;
}) {
  const Icon = ICON[answer.status];
  const counts = answer.counts;

  return (
    <section aria-label="Saúde da sua moto" className="surface-elevated rounded-3xl px-5 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Saúde da sua moto</p>
          <h2 className={`mt-1 flex items-center gap-2 font-display text-xl font-bold ${HEALTH_STATUS_TEXT[answer.status]}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="min-w-0">{answer.title}</span>
          </h2>
        </div>
        <TBStatusPill status={answer.status} className="shrink-0" />
      </div>

      <p className="mt-3 text-sm leading-snug">{answer.message}</p>
      <p className="mt-1 text-sm text-muted-foreground">{answer.rationale}</p>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CountBox label="Críticos" value={counts.critical} status="action" />
        <CountBox label="Em atenção" value={counts.attention} status="attention" />
        <CountBox label="OK" value={counts.ok} status="ok" />
        <CountBox label="Sem dados" value={counts.unknown} status="unknown" />
      </dl>

      {answer.nextAction && (
        <div className="mt-4 rounded-2xl bg-muted/50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Próxima ação
          </p>
          <p className="mt-0.5 text-sm">{answer.nextAction.label}</p>
          <p className="text-xs text-muted-foreground">Prazo: {answer.nextAction.dueEstimateLabel}</p>
        </div>
      )}

      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}

      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>{answer.disclaimer}</span>
      </p>
    </section>
  );
}

function CountBox({ label, value, status }: { label: string; value: number; status: HealthStatus }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={`font-display text-lg font-bold ${value > 0 ? HEALTH_STATUS_TEXT[status] : "text-muted-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}
