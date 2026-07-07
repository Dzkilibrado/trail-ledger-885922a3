import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCockpitSnapshot } from "@/lib/til";
import type { CockpitSnapshot } from "@/lib/til";
import type { Motorcycle } from "@/lib/trailbook";
import { ComponentCard } from "@/components/components/ComponentCard";
import { ComponentSheet } from "@/components/components/ComponentSheet";
import { CheckCircle2, AlertTriangle, Clock, HelpCircle, Heart } from "lucide-react";

/**
 * Saúde da Moto — check-up visual do estado atual, alimentado 100% pela TIL.
 * Nada é calculado aqui: leitura direta de `snapshot.health.buckets`.
 */
export function HealthOverview({ moto, isOwner }: { moto: Motorcycle; isOwner: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const events = useQuery({
    queryKey: ["events", moto.id],
    queryFn: async () => (await supabase.from("events").select("*").eq("motorcycle_id", moto.id).order("occurred_at", { ascending: false })).data ?? [],
  });
  const schedules = useQuery({
    queryKey: ["schedules", moto.id],
    queryFn: async () => (await supabase.from("maintenance_schedules").select("*").eq("motorcycle_id", moto.id)).data ?? [],
  });
  const items = useQuery({
    queryKey: ["maintenance-items", moto.id],
    queryFn: async () => {
      const ids = (events.data ?? []).map((e) => e.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("maintenance_items").select("event_id, schedule_id, created_at").in("event_id", ids);
      return data ?? [];
    },
    enabled: !!events.data,
  });
  const attachments = useQuery({
    queryKey: ["attachments", moto.id],
    queryFn: async () => {
      const ids = (events.data ?? []).map((e) => e.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("event_attachments").select("*").in("event_id", ids);
      return data ?? [];
    },
    enabled: !!events.data,
  });

  const snapshot: CockpitSnapshot | null = useMemo(() => {
    if (!schedules.data || !events.data) return null;
    return computeCockpitSnapshot({
      moto,
      events: events.data,
      schedules: schedules.data,
      attachments: attachments.data ?? [],
      maintenanceItems: items.data ?? [],
      isOwner,
    });
  }, [moto, events.data, schedules.data, attachments.data, items.data, isOwner]);

  const selected = useMemo(
    () => snapshot?.components.find((c) => c.scheduleId === selectedId) ?? null,
    [snapshot, selectedId],
  );

  if (!snapshot) {
    return <div className="surface-elevated h-56 animate-pulse rounded-3xl" />;
  }

  const { health } = snapshot;
  const grade = health.grade;
  const accent =
    grade === "excellent" ? "text-emerald-400"
    : grade === "good"    ? "text-primary"
    : grade === "attention" ? "text-amber-400"
                            : "text-destructive";
  const GradeIcon = grade === "critical" ? AlertTriangle : grade === "attention" ? Clock : Heart;

  return (
    <div className="space-y-5">
      {/* Diagnóstico geral */}
      <section
        aria-label="Diagnóstico geral"
        className="surface-elevated rounded-3xl px-6 py-7 text-center"
      >
        <div className={`inline-flex items-center gap-2 text-xs uppercase tracking-widest ${accent}`}>
          <GradeIcon className="h-4 w-4" />
          <span>{health.gradeLabel}</span>
        </div>
        <div className="mt-3 font-display text-5xl font-bold sm:text-6xl">
          {health.score}<span className="ml-1 text-xl text-muted-foreground sm:text-2xl">%</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{health.headline}</p>
      </section>

      {/* Buckets */}
      <Bucket
        title="Vencidos"
        subtitle="Resolva antes de rodar"
        tone="critical"
        icon={AlertTriangle}
        items={health.buckets.overdue}
        onOpen={setSelectedId}
        emptyLabel="Nenhum componente vencido"
      />
      <Bucket
        title="Merecem atenção"
        subtitle="Planeje a próxima manutenção"
        tone="attention"
        icon={Clock}
        items={health.buckets.attention}
        onOpen={setSelectedId}
        emptyLabel="Nada pendente por enquanto"
      />
      <Bucket
        title="Sem informação"
        subtitle="Informe a última manutenção para acompanhar"
        tone="no_info"
        icon={HelpCircle}
        items={health.buckets.noInfo}
        onOpen={setSelectedId}
        emptyLabel="Todos os componentes já têm histórico"
        defaultCollapsed
      />
      <Bucket
        title="Em dia"
        subtitle="Componentes dentro do intervalo"
        tone="ok"
        icon={CheckCircle2}
        items={health.buckets.ok}
        onOpen={setSelectedId}
        emptyLabel="—"
        defaultCollapsed
      />

      <ComponentSheet
        moto={moto}
        component={selected}
        open={!!selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
        isOwner={isOwner}
      />
    </div>
  );
}

const TONE_ACCENT = {
  critical:  { badge: "bg-destructive/10 text-destructive",  ring: "ring-destructive/20" },
  attention: { badge: "bg-amber-500/10 text-amber-400",      ring: "ring-amber-400/20" },
  no_info:   { badge: "bg-muted text-muted-foreground",      ring: "ring-border" },
  ok:        { badge: "bg-emerald-500/10 text-emerald-400",  ring: "ring-emerald-500/20" },
} as const;

function Bucket({
  title, subtitle, tone, icon: Icon, items, onOpen, emptyLabel, defaultCollapsed,
}: {
  title: string;
  subtitle: string;
  tone: keyof typeof TONE_ACCENT;
  icon: React.ComponentType<{ className?: string }>;
  items: import("@/lib/til/components").ComponentView[];
  onOpen: (id: string) => void;
  emptyLabel: string;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const t = TONE_ACCENT[tone];
  const count = items.length;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <span className={`grid h-8 w-8 place-items-center rounded-full ring-1 ${t.ring} ${t.badge}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.badge}`}>{count}</span>
      </button>
      {open && (
        count === 0
          ? <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{emptyLabel}</div>
          : <div className="space-y-2">
              {items.map((c) => <ComponentCard key={c.scheduleId} component={c} onOpen={onOpen} />)}
            </div>
      )}
    </section>
  );
}