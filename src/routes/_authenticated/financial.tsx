import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, EVENT_TYPE_LABEL } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/financial")({
  head: () => ({ meta: [{ title: "Financeiro — TrailBook" }] }),
  component: Financial,
});

function Financial() {
  const events = useQuery({
    queryKey: ["events", "all-with-cost"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*, motorcycles(nickname, model)").not("cost", "is", null).order("occurred_at", { ascending: false });
      return data ?? [];
    },
  });

  const total = events.data?.reduce((s, e) => s + Number(e.cost), 0) ?? 0;
  const byType: Record<string, number> = {};
  events.data?.forEach((e) => { byType[e.type] = (byType[e.type] || 0) + Number(e.cost); });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Financeiro</h1>

      <div className="surface-elevated rounded-2xl p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Total investido</div>
        <div className="font-display text-4xl font-bold text-primary">{brl(total)}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Por tipo</h2>
          <div className="space-y-2">
            {Object.entries(byType).map(([t, v]) => (
              <div key={t} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{EVENT_TYPE_LABEL[t as keyof typeof EVENT_TYPE_LABEL]}</span>
                <span className="font-semibold">{brl(v)}</span>
              </div>
            ))}
            {Object.keys(byType).length === 0 && <div className="text-sm text-muted-foreground">Sem gastos registrados.</div>}
          </div>
        </div>

        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Últimos lançamentos</h2>
          <div className="space-y-2">
            {events.data?.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{(e.motorcycles as any)?.nickname || (e.motorcycles as any)?.model}</div>
                </div>
                <div className="font-semibold text-primary">{brl(Number(e.cost))}</div>
              </div>
            )) ?? null}
          </div>
        </div>
      </div>
    </div>
  );
}