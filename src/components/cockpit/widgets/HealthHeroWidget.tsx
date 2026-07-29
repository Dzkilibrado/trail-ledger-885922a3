import type { CockpitSnapshot } from "@/lib/til";
import { TBStatusPill } from "@/design-system/primitives/TBStatusPill";
import { HEALTH_STATUS_TEXT } from "@/lib/til/status";
import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";

const ICON = {
  ok: CheckCircle2,
  attention: Clock,
  action: AlertTriangle,
  unknown: HelpCircle,
} as const;

/**
 * Estado da moto no Cockpit — linguagem de status, nunca nota.
 * Responde diretamente: "posso rodar hoje?".
 */
export function HealthHeroWidget({ snapshot }: { snapshot: CockpitSnapshot }) {
  const answer = snapshot.rideAnswer;
  const status = answer.status;
  const Icon = ICON[status];

  return (
    <section
      aria-label="Estado da moto"
      className="surface-elevated space-y-3 rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted ${HEALTH_STATUS_TEXT[status]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{answer.title}</div>
          <p className="text-xs leading-snug text-muted-foreground">{answer.message}</p>
        </div>
        <TBStatusPill status={status} size="sm" className="shrink-0" />
      </div>
      <p className="text-xs text-muted-foreground">{answer.rationale}</p>
      {answer.nextAction && (
        <p className="text-xs font-medium">
          Próxima ação: {answer.nextAction.label}
        </p>
      )}
    </section>
  );
}
