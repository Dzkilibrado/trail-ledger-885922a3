import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, AlertTriangle, Clock, CheckCircle2, EyeOff, Pause, Bike } from "lucide-react";
import {
  priorityList,
  evaluateSchedule,
  usageRate,
  type ScheduleStatus,
} from "@/lib/maintenance-engine";
import { MAINT_CATEGORY_LABEL, formatDate, type MaintenanceCategory } from "@/lib/trailbook";
import { PageHeader } from "@/components/PageHeader";
import { ScheduleActionsMenu } from "@/components/ScheduleActionsMenu";
import { NewEventDialog } from "@/components/NewEventDialog";
import { useActiveMotorcycles } from "@/hooks/useActiveMotorcycle";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — TrailBook" }] }),
  component: Agenda,
});

type FilterKey = "all" | "overdue" | "soon" | "ok" | "snoozed" | "ignored" | "done";
type ExtStatus = "overdue" | "due" | "soon" | "ok" | "snoozed" | "ignored" | "done";

type Entry = {
  moto: any;
  schedule: any;
  status: ExtStatus;
  /** ScheduleStatus do engine quando aplicável (active). */
  computed: ScheduleStatus | null;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "overdue", label: "Vencidas" },
  { key: "soon", label: "Próximas" },
  { key: "ok", label: "Em dia" },
  { key: "snoozed", label: "Postergadas" },
  { key: "ignored", label: "Ignoradas" },
  { key: "done", label: "Concluídas" },
];

const STATUS_META: Record<ExtStatus, { label: string; badge: string; bar: string; icon: any }> = {
  overdue: {
    label: "Vencida",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    bar: "bg-destructive",
    icon: AlertTriangle,
  },
  due: {
    label: "Vence agora",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    bar: "bg-amber-400",
    icon: AlertTriangle,
  },
  soon: {
    label: "Próxima",
    badge: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    bar: "bg-amber-300",
    icon: Clock,
  },
  ok: {
    label: "Em dia",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    bar: "bg-emerald-400",
    icon: CheckCircle2,
  },
  snoozed: {
    label: "Postergada",
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    bar: "bg-sky-400/50",
    icon: Pause,
  },
  ignored: {
    label: "Ignorada",
    badge: "bg-muted text-muted-foreground border-border",
    bar: "bg-muted",
    icon: EyeOff,
  },
  done: {
    label: "Concluída",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    bar: "bg-emerald-400",
    icon: CheckCircle2,
  },
};

function Agenda() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [completeFor, setCompleteFor] = useState<{ moto: any; schedule: any } | null>(null);

  const motos = useActiveMotorcycles();
  const schedules = useQuery({
    queryKey: ["schedules"],
    queryFn: async () =>
      (await supabase.from("maintenance_schedules").select("*").eq("active", true)).data ?? [],
  });
  const events = useQuery({
    queryKey: ["events", "all"],
    queryFn: async () =>
      (
        await supabase
          .from("events")
          .select("id, motorcycle_id, occurred_at, hours_delta, km_delta")
      ).data ?? [],
  });

  // Computa todas as entradas com status estendido (sem filtrar dormentes)
  const entries: Entry[] = useMemo(() => {
    const now = Date.now();
    const out: Entry[] = [];
    for (const moto of motos.data ?? []) {
      const mySchedules = (schedules.data ?? []).filter((s) => s.motorcycle_id === moto.id);
      const myEvents = (events.data ?? []).filter((e) => e.motorcycle_id === moto.id);
      const rate = usageRate(myEvents as any);
      for (const sch of mySchedules) {
        const stCol = (sch as any).status as string | null;
        const until = (sch as any).snoozed_until as string | null;
        if (stCol === "ignored") {
          out.push({ moto, schedule: sch, status: "ignored", computed: null });
          continue;
        }
        if (stCol === "done") {
          out.push({ moto, schedule: sch, status: "done", computed: null });
          continue;
        }
        if (stCol === "snoozed" && until && new Date(until).getTime() > now) {
          out.push({ moto, schedule: sch, status: "snoozed", computed: null });
          continue;
        }
        const computed = evaluateSchedule(sch, moto, rate);
        out.push({ moto, schedule: sch, status: computed.status as ExtStatus, computed });
      }
    }
    // Ordenação: vencidas > devidas > próximas > em dia > postergadas > ignoradas > concluídas
    const order: ExtStatus[] = ["overdue", "due", "soon", "ok", "snoozed", "ignored", "done"];
    out.sort((a, b) => {
      const da = order.indexOf(a.status),
        db = order.indexOf(b.status);
      if (da !== db) return da - db;
      const pa = a.computed?.progress ?? 0;
      const pb = b.computed?.progress ?? 0;
      return pb - pa;
    });
    return out;
  }, [motos.data, schedules.data, events.data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: entries.length,
      overdue: 0,
      soon: 0,
      ok: 0,
      snoozed: 0,
      ignored: 0,
      done: 0,
    };
    for (const e of entries) {
      if (e.status === "overdue" || e.status === "due") c.overdue++;
      else if (e.status === "soon") c.soon++;
      else if (e.status === "ok") c.ok++;
      else c[e.status]++;
    }
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "overdue")
      return entries.filter((e) => e.status === "overdue" || e.status === "due");
    if (filter === "soon") return entries.filter((e) => e.status === "soon");
    if (filter === "ok") return entries.filter((e) => e.status === "ok");
    return entries.filter((e) => e.status === filter);
  }, [entries, filter]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agenda inteligente"
        description="Próximas manutenções calculadas a partir do uso real de cada motocicleta."
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const n = counts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
            >
              {f.label} <span className="ml-1 text-[10px] opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <div className="surface-elevated rounded-2xl p-10 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-bold">Nenhum lembrete configurado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra uma moto e use <strong>Plano de manutenção</strong> para aplicar o catálogo
            recomendado.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-elevated rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Nenhum item nesse filtro.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((e) => (
            <AgendaCard
              key={e.schedule.id}
              entry={e}
              onComplete={() => setCompleteFor({ moto: e.moto, schedule: e.schedule })}
            />
          ))}
        </ul>
      )}

      {completeFor && (
        <NewEventDialog
          moto={completeFor.moto}
          preset={{
            scheduleId: completeFor.schedule.id,
            name: completeFor.schedule.name,
            category: completeFor.schedule.category,
            templateItemId: (completeFor.schedule as any).template_item_id ?? null,
          }}
          open={!!completeFor}
          onOpenChange={(v) => !v && setCompleteFor(null)}
        />
      )}
    </div>
  );
}

function AgendaCard({ entry, onComplete }: { entry: Entry; onComplete: () => void }) {
  const { moto, schedule, status, computed } = entry;
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const progress = Math.min(100, (computed?.progress ?? 0) * 100);

  const lastDoneAt = schedule.last_done_at as string | null;
  const snoozedUntil = schedule.snoozed_until as string | null;

  return (
    <li className="surface-elevated rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${meta.badge}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{schedule.name}</div>
              <Link
                to="/motorcycles/$id"
                params={{ id: moto.id }}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Bike className="h-3 w-3" /> {moto.nickname || moto.model}
                <span className="opacity-50">·</span>
                <span>{MAINT_CATEGORY_LABEL[schedule.category as MaintenanceCategory]}</span>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${meta.badge}`}
              >
                {meta.label}
              </span>
              <ScheduleActionsMenu schedule={schedule} onComplete={onComplete} />
            </div>
          </div>

          {computed && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {computed.remaining.hours != null && (
                <span>{computed.remaining.hours.toFixed(1)} h restantes</span>
              )}
              {computed.remaining.km != null && (
                <span>{computed.remaining.km.toFixed(0)} km restantes</span>
              )}
              {computed.remaining.days != null && (
                <span>{Math.round(computed.remaining.days)} dias restantes</span>
              )}
              {computed.estimatedDueDate && (
                <span>· est. {computed.estimatedDueDate.toLocaleDateString("pt-BR")}</span>
              )}
            </div>
          )}

          {!computed && status === "snoozed" && snoozedUntil && (
            <div className="mt-2 text-xs text-muted-foreground">
              Reaparece em {formatDate(snoozedUntil)}
            </div>
          )}
          {lastDoneAt && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Última execução: {formatDate(lastDoneAt)}
            </div>
          )}

          {computed && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full ${meta.bar}`} style={{ width: `${progress}%` }} />
            </div>
          )}

          {(status === "overdue" || status === "due" || status === "soon") && (
            <div className="mt-3">
              <button
                onClick={onComplete}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Registrar manutenção concluída
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
