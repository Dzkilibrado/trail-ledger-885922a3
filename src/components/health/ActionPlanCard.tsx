import { AlertTriangle, CalendarClock, ChevronRight, Eye, HelpCircle, ListChecks } from "lucide-react";
import { TBStatusDot } from "@/design-system/primitives/TBStatusPill";
import {
  ACTION_GROUP_DESCRIPTION,
  ACTION_GROUP_LABEL,
  ACTION_GROUP_ORDER,
  type ActionGroup,
  type ActionPlanItem,
} from "@/lib/til/action-plan";
import { RECOMMENDATION_STATUS_LABEL } from "@/lib/til/recommendations";
import { CONFIDENCE_SHORT, type ConfidenceLevel } from "@/lib/til/confidence";

const GROUP_ICON: Record<ActionGroup, React.ComponentType<{ className?: string }>> = {
  before_use: AlertTriangle,
  schedule_soon: CalendarClock,
  monitor: Eye,
  complete_data: HelpCircle,
};

const GROUP_ACCENT: Record<ActionGroup, string> = {
  before_use: "text-destructive",
  schedule_soon: "text-amber-400",
  monitor: "text-primary",
  complete_data: "text-muted-foreground",
};

/**
 * Plano de Ação — todo diagnóstico gera recomendação priorizada.
 * Nunca depende só de cor: ícone + texto + descrição acompanham cada grupo.
 */
export function ActionPlanCard({
  plan,
  onOpen,
}: {
  plan: ActionPlanItem[];
  onOpen?: (scheduleId: string) => void;
}) {
  if (plan.length === 0) {
    return (
      <section
        aria-label="Plano de ação"
        className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-5 text-center"
      >
        <ListChecks className="mx-auto h-5 w-5 text-emerald-500" aria-hidden />
        <p className="mt-2 text-sm font-medium">Nenhuma ação pendente</p>
        <p className="text-xs text-muted-foreground">
          Continue registrando as atividades para manter o acompanhamento em dia.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Plano de ação" className="space-y-4">
      <header className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Plano de ação</h2>
      </header>

      {ACTION_GROUP_ORDER.map((group) => {
        const items = plan.filter((i) => i.group === group);
        if (items.length === 0) return null;
        const Icon = GROUP_ICON[group];
        return (
          <div key={group} className="space-y-2">
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${GROUP_ACCENT[group]}`} aria-hidden />
              <div className="min-w-0">
                <h3 className={`text-xs font-semibold uppercase tracking-widest ${GROUP_ACCENT[group]}`}>
                  {ACTION_GROUP_LABEL[group]} · {items.length}
                </h3>
                <p className="text-xs text-muted-foreground">{ACTION_GROUP_DESCRIPTION[group]}</p>
              </div>
            </div>

            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.scheduleId}>
                  <button
                    type="button"
                    onClick={() => onOpen?.(item.scheduleId)}
                    aria-label={`${item.title}: ${ACTION_GROUP_LABEL[group]}. ${item.recommendation}`}
                    className="grid min-h-[56px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
                  >
                    <TBStatusDot status={item.status} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{item.title}</span>
                        {item.isSafetyItem && (
                          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-destructive">
                            Segurança
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{item.recommendation}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {item.suggestedActionLabel} · Prazo: {item.dueEstimateLabel} ·{" "}
                        {RECOMMENDATION_STATUS_LABEL[item.lifecycle]} · Confiabilidade:{" "}
                        {CONFIDENCE_SHORT[item.confidenceLevel as ConfidenceLevel] ?? item.confidenceLevel}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
