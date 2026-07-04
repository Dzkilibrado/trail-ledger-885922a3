import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Activity, Wrench, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoragePhoto } from "@/components/StoragePhoto";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TrailBook" }] }),
  component: Dashboard,
});

function Dashboard() {
  const motos = useQuery({
    queryKey: ["motorcycles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("*").eq("status" as never, "active" as never).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, motorcycles(nickname, brand, model)")
        .order("occurred_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const totalHours = motos.data?.reduce((s, m) => s + Number(m.hours_total), 0) ?? 0;
  const totalKm = motos.data?.reduce((s, m) => s + Number(m.km_total), 0) ?? 0;
  const totalCost = events.data?.reduce((s, e) => s + (Number(e.cost) || 0), 0) ?? 0;

  if (motos.isLoading) return <div className="text-muted-foreground">Carregando…</div>;

  if ((motos.data?.length ?? 0) === 0) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <h2 className="font-display text-2xl font-bold">Bem-vindo ao TrailBook</h2>
        <p className="mt-2 text-muted-foreground">Cadastre sua primeira moto para começar o histórico.</p>
        <Link to="/motorcycles/new" className="mt-6 inline-block">
          <Button className="btn-glow"><Plus className="h-4 w-4" /> Cadastrar moto</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Activity} label="Motos" value={String(motos.data?.length ?? 0)} />
        <MetricCard icon={TrendingUp} label="Horas totais" value={`${totalHours.toFixed(1)} h`} />
        <MetricCard icon={Calendar} label="Km totais" value={totalKm.toFixed(0)} />
        <MetricCard icon={Wrench} label="Investido" value={brl(totalCost)} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Suas motos</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {motos.data!.map((m) => (
            <Link key={m.id} to="/motorcycles/$id" params={{ id: m.id }} className="surface-elevated group overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5">
              <StoragePhoto path={m.main_photo_url} className="h-44 w-full" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{m.brand}</div>
                    <div className="font-display text-lg font-bold">{m.nickname || `${m.model} ${m.year_model || ""}`}</div>
                  </div>
                  <div className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{m.conservation_score}</div>
                </div>
                <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                  <span>{Number(m.hours_total).toFixed(1)} h</span>
                  <span>{Number(m.km_total).toFixed(0)} km</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Últimos eventos</h2>
        <div className="surface-elevated divide-y divide-border rounded-2xl">
          {events.data && events.data.length > 0 ? events.data.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-4">
              <EventTypeIcon type={e.type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.title}</div>
                <div className="text-xs text-muted-foreground">
                  {EVENT_TYPE_LABEL[e.type]} · {formatDate(e.occurred_at)}
                  {e.motorcycles && ` · ${(e.motorcycles as any).nickname || (e.motorcycles as any).model}`}
                </div>
              </div>
              {e.cost != null && <div className="text-sm font-semibold text-primary">{brl(Number(e.cost))}</div>}
            </div>
          )) : (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem eventos ainda. Registre o primeiro na página da moto.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="surface-elevated rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="font-display text-xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}