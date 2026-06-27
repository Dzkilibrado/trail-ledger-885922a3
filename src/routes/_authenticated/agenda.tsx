import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { priorityList, type ScheduleStatus } from "@/lib/maintenance-engine";
import { MAINT_CATEGORY_LABEL } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — TrailBook" }] }),
  component: Agenda,
});

function Agenda() {
  const motos = useQuery({
    queryKey: ["motorcycles"],
    queryFn: async () => (await supabase.from("motorcycles").select("*")).data ?? [],
  });
  const schedules = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => (await supabase.from("maintenance_schedules").select("*").eq("active", true)).data ?? [],
  });
  const events = useQuery({
    queryKey: ["events", "all"],
    queryFn: async () => (await supabase.from("events").select("id, motorcycle_id, occurred_at, hours_delta, km_delta")).data ?? [],
  });

  // Agrupa por moto e roda o engine
  type Entry = { moto: any; status: ScheduleStatus };
  const entries: Entry[] = [];
  for (const moto of motos.data ?? []) {
    const mySchedules = (schedules.data ?? []).filter((s) => s.motorcycle_id === moto.id);
    if (mySchedules.length === 0) continue;
    const myEvents = (events.data ?? []).filter((e) => e.motorcycle_id === moto.id);
    const list = priorityList(mySchedules, moto, myEvents as any);
    for (const status of list) entries.push({ moto, status });
  }
  // Mesma prioridade da entry mais crítica
  entries.sort((a, b) => (b.status.progress - a.status.progress));

  const overdueCount = entries.filter((e) => e.status.status === "overdue").length;
  const dueCount = entries.filter((e) => e.status.status === "due" || e.status.status === "soon").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Agenda inteligente</h1>
          <p className="text-sm text-muted-foreground">Próximas manutenções calculadas a partir do uso real de cada moto.</p>
        </div>
        <div className="flex gap-2">
          <Badge color="destructive" icon={AlertTriangle} label={`${overdueCount} vencidas`} />
          <Badge color="amber" icon={Clock} label={`${dueCount} próximas`} />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="surface-elevated rounded-2xl p-10 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-bold">Nenhum lembrete configurado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra uma moto e use <strong>Programações</strong> para aplicar o catálogo recomendado.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(({ moto, status: s }) => {
            const Icon = s.status === "overdue" ? AlertTriangle : s.status === "due" || s.status === "soon" ? Clock : CheckCircle2;
            const color =
              s.status === "overdue" ? "text-destructive" :
              s.status === "due" ? "text-amber-400" :
              s.status === "soon" ? "text-amber-300" : "text-emerald-400";
            const barColor =
              s.status === "overdue" || s.status === "due" ? "bg-destructive" :
              s.status === "soon" ? "bg-amber-400" : "bg-emerald-400";
            return (
              <li key={s.schedule.id} className="surface-elevated rounded-2xl">
                <Link to="/motorcycles/$id" params={{ id: moto.id }} className="block p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-semibold">{s.label}</div>
                        <div className={`text-xs ${color}`}>
                          {s.status === "overdue" ? "Vencida" : s.status === "due" ? "Vence agora" : s.status === "soon" ? "Em breve" : "Em dia"}
                        </div>
                      </div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        {moto.nickname || moto.model} · {MAINT_CATEGORY_LABEL[s.category]}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {s.remaining.hours != null && <span>{s.remaining.hours.toFixed(1)} h</span>}
                        {s.remaining.km != null && <span>{s.remaining.km.toFixed(0)} km</span>}
                        {s.remaining.days != null && <span>{Math.round(s.remaining.days)} dias</span>}
                        {s.estimatedDueDate && <span>· estimado {s.estimatedDueDate.toLocaleDateString("pt-BR")}</span>}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, s.progress * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Badge({ color, icon: Icon, label }: { color: "destructive" | "amber"; icon: any; label: string }) {
  const cls = color === "destructive" ? "bg-destructive/15 text-destructive" : "bg-amber-400/15 text-amber-400";
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
  );
}