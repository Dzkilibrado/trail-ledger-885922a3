import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";

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
    queryFn: async () => (await supabase.from("maintenance_schedules").select("*, motorcycles(nickname, model)").eq("active", true)).data ?? [],
  });

  const alerts = (schedules.data ?? []).map((s) => {
    const moto = motos.data?.find((m) => m.id === s.motorcycle_id);
    if (!moto) return null;
    const dueHours = s.interval_hours && s.last_done_hours != null ? Number(s.last_done_hours) + Number(s.interval_hours) - Number(moto.hours_total) : null;
    const dueKm = s.interval_km && s.last_done_km != null ? Number(s.last_done_km) + Number(s.interval_km) - Number(moto.km_total) : null;
    const dueDays = s.interval_days && s.last_done_at ? Math.round((new Date(s.last_done_at).getTime() + s.interval_days * 86400000 - Date.now()) / 86400000) : null;
    return { s, moto, dueHours, dueKm, dueDays };
  }).filter(Boolean) as any[];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Agenda inteligente</h1>
      {alerts.length === 0 ? (
        <div className="surface-elevated rounded-2xl p-10 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-bold">Nenhum lembrete configurado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre intervalos de manutenção em cada moto para receber alertas automáticos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(({ s, moto, dueHours, dueKm, dueDays }) => {
            const overdue = [dueHours, dueKm, dueDays].some((v) => v != null && v < 0);
            return (
              <Link key={s.id} to="/motorcycles/$id" params={{ id: moto.id }} className="surface-elevated flex items-center justify-between rounded-2xl p-4">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{moto.nickname || moto.model}</div>
                </div>
                <div className={overdue ? "text-destructive" : "text-primary"}>
                  {dueHours != null && <span>{dueHours.toFixed(1)} h </span>}
                  {dueKm != null && <span>{dueKm.toFixed(0)} km </span>}
                  {dueDays != null && <span>{dueDays} dias</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}