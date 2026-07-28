import type { ScheduleStatus } from "@/lib/maintenance-engine";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory } from "@/lib/trailbook";
import type { EventRow, Schedule } from "./types";

export type ComponentTone = "critical" | "attention" | "ok" | "no_info" | "not_applicable";

export type ComponentSeverity = "low" | "medium" | "high" | "critical";

export const SEVERITY_LABEL: Record<ComponentSeverity, string> = {
  low: "Normal",
  medium: "Atenção",
  high: "Alta",
  critical: "Crítica",
};

export interface ComponentHistoryEntry {
  eventId: string;
  occurredAt: string;
  hoursAtEvent: number | null;
  kmAtEvent: number | null;
  title: string;
  note: string | null;
}

export interface ComponentView {
  scheduleId: string;
  name: string;
  category: MaintenanceCategory;
  categoryLabel: string;
  tone: ComponentTone;
  statusLabel: string;             // "Faltam 8 h" / "Vencido há 300 km" / "Sem informação"
  actionHint: string;              // "Registrar manutenção" / "Marcar como revisado"
  lastMaintenance: {
    date: string | null;
    hours: number | null;
    km: number | null;
  } | null;
  nextPrevision: {
    hoursLeft: number | null;
    kmLeft: number | null;
    daysLeft: number | null;
  } | null;
  history: ComponentHistoryEntry[];
  notes: string | null;
  pinned: boolean;
  hidden: boolean;
  rawStatus: string;               // schedule_status
  severity: ComponentSeverity;
  isCustom: boolean;
}

function labelFromStatus(s: ScheduleStatus): { tone: ComponentTone; label: string } {
  if (s.status === "overdue") {
    if (s.drivenBy === "hours" && s.remaining.hours != null) return { tone: "critical", label: `Vencido há ${Math.abs(s.remaining.hours).toFixed(1)} h` };
    if (s.drivenBy === "km" && s.remaining.km != null) return { tone: "critical", label: `Vencido há ${Math.abs(s.remaining.km).toFixed(0)} km` };
    if (s.drivenBy === "days" && s.remaining.days != null) return { tone: "critical", label: `Vencido há ${Math.abs(Math.round(s.remaining.days))} dias` };
    return { tone: "critical", label: "Vencido" };
  }
  if (s.status === "due" || s.status === "soon") {
    if (s.remaining.hours != null && s.remaining.hours < 20) return { tone: "attention", label: `Faltam ${s.remaining.hours.toFixed(1)} h` };
    if (s.remaining.km != null && s.remaining.km < 500) return { tone: "attention", label: `Faltam ${s.remaining.km.toFixed(0)} km` };
    if (s.remaining.days != null && s.remaining.days < 30) return { tone: "attention", label: `Faltam ${Math.round(s.remaining.days)} dias` };
    return { tone: "attention", label: "Próximo do vencimento" };
  }
  // ok
  if (s.remaining.hours != null) return { tone: "ok", label: `Em dia · ${s.remaining.hours.toFixed(1)} h restantes` };
  if (s.remaining.km != null) return { tone: "ok", label: `Em dia · ${s.remaining.km.toFixed(0)} km restantes` };
  if (s.remaining.days != null) return { tone: "ok", label: `Em dia · ${Math.round(s.remaining.days)} dias restantes` };
  return { tone: "ok", label: "Em dia" };
}

function toneWeight(t: ComponentTone): number {
  switch (t) {
    case "critical": return 0;
    case "attention": return 1;
    case "ok": return 2;
    case "no_info": return 3;
    case "not_applicable": return 4;
  }
}

/**
 * Constrói a visão canônica de cada componente da moto.
 * Ordenada por prioridade: críticos → atenção → em dia → sem informação → não se aplica.
 * Fixados sobem dentro do próprio grupo.
 */
export function computeComponentViews(
  schedules: Schedule[],
  statuses: ScheduleStatus[],
  events: EventRow[],
  itemsByScheduleId: Record<string, { event_id: string; created_at: string }[]>,
): ComponentView[] {
  const statusById = new Map(statuses.map((s) => [s.schedule.id, s] as const));
  const eventById = new Map(events.map((e) => [e.id, e] as const));

  const views: ComponentView[] = schedules.map((sch) => {
    const s = statusById.get(sch.id);
    const status = (sch as any).status as string;

    let tone: ComponentTone = "ok";
    let statusLabel = "Em dia";
    let actionHint = "Nada a fazer agora";

    if (status === "not_applicable") {
      tone = "not_applicable";
      statusLabel = "Não se aplica";
      actionHint = "Restaurar componente";
    } else if (status === "no_info") {
      tone = "no_info";
      statusLabel = "Sem informação";
      actionHint = "Informar última manutenção";
    } else if (s) {
      const l = labelFromStatus(s);
      tone = l.tone;
      statusLabel = l.label;
      actionHint = tone === "critical" || tone === "attention" ? "Registrar manutenção" : "Ver histórico";
    }

    const nextPrevision = s
      ? {
          hoursLeft: s.remaining.hours ?? null,
          kmLeft: s.remaining.km ?? null,
          daysLeft: s.remaining.days != null ? Math.round(s.remaining.days) : null,
        }
      : null;

    const lastMaintenance = sch.last_done_at || sch.last_done_hours != null || sch.last_done_km != null
      ? {
          date: sch.last_done_at,
          hours: sch.last_done_hours != null ? Number(sch.last_done_hours) : null,
          km: sch.last_done_km != null ? Number(sch.last_done_km) : null,
        }
      : null;

    const items = itemsByScheduleId[sch.id] ?? [];
    const history: ComponentHistoryEntry[] = items
      .map((it) => {
        const ev = eventById.get(it.event_id);
        if (!ev) return null;
        return {
          eventId: ev.id,
          occurredAt: ev.occurred_at,
          hoursAtEvent: ev.hours_at_event != null ? Number(ev.hours_at_event) : null,
          kmAtEvent: ev.km_at_event != null ? Number(ev.km_at_event) : null,
          title: ev.title,
          note: ev.description ?? null,
        } as ComponentHistoryEntry;
      })
      .filter((x): x is ComponentHistoryEntry => !!x)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

    return {
      scheduleId: sch.id,
      name: sch.name,
      category: sch.category,
      categoryLabel: MAINT_CATEGORY_LABEL[sch.category] ?? sch.category,
      tone,
      statusLabel,
      actionHint,
      lastMaintenance,
      nextPrevision,
      history,
      notes: sch.notes ?? null,
      pinned: !!(sch as any).pinned,
      hidden: !!(sch as any).hidden,
      rawStatus: status,
      severity: ((sch as any).severity as ComponentSeverity) ?? "medium",
      isCustom: !!(sch as any).is_custom,
    };
  });

  return views.sort((a, b) => {
    if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const w = toneWeight(a.tone) - toneWeight(b.tone);
    if (w !== 0) return w;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

export function groupComponentsByCategory(components: ComponentView[]): Array<{ category: MaintenanceCategory; label: string; items: ComponentView[] }> {
  const map = new Map<MaintenanceCategory, ComponentView[]>();
  for (const c of components) {
    if (c.hidden) continue;
    const arr = map.get(c.category) ?? [];
    arr.push(c);
    map.set(c.category, arr);
  }
  // Ordem das categorias: seguir a ordem do MAINT_CATEGORY_LABEL
  return (Object.keys(MAINT_CATEGORY_LABEL) as MaintenanceCategory[])
    .filter((cat) => map.has(cat))
    .map((cat) => ({ category: cat, label: MAINT_CATEGORY_LABEL[cat], items: map.get(cat)! }));
}