import { ChevronRight, ListChecks } from "lucide-react";
import { TBStatusDot } from "@/design-system/primitives/TBStatusPill";
import { ACTION_PRIORITY_LABEL, type ActionPlanItem, type ActionPriority } from "@/lib/til/action-plan";

const ORDER: ActionPriority[] = ["critical", "preventive", "informative"];

const GROUP_ACCENT: Record<ActionPriority, string> = {
  critical: "text-destructive",
  preventive: "text-amber-400",
  informative: "text-muted-foreground",
};

/**
 * Plano de Ação — todo diagnóstico gera uma recomendação priorizada.
 * Ordem oficial: resolver antes de rodar → programar → completar informação.
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
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-5 text-center">
        <ListChecks className="mx-auto h-5 w-5 text-emerald-500" aria-hidden />
        <p className="mt-2 text-sm font-medium">Nenhuma ação pendente</p>
        <p className="text-xs text-muted-foreground">Continue registrando as atividades para manter o acompanhamento.</p>
      </section>
    );
  }

  return (
    <section aria-label="Plano de ação" className="space-y-3">
      <header className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Plano de ação</h2>
      </header>

      {ORDER.map((priority) => {
        const items = plan.filter((i) => i.priority === priority);
        if (items.length === 0) return null;
        return (
          <div key={priority} className="space-y-2">
            <div className={`text-[11px] font-semibold uppercase tracking-widest ${GROUP_ACCENT[priority]}`}>
              {ACTION_PRIORITY_LABEL[priority]} · {items.length}
            </div>
            {items.map((item) => (
              <button
                key={item.scheduleId}
                type="button"
                onClick={() => onOpen?.(item.scheduleId)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-primary/40 active:scale-[0.99]"
              >
                <TBStatusDot status={item.status} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{item.recommendation}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
