import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCockpitSnapshot } from "@/lib/til";
import type { CockpitSnapshot } from "@/lib/til";
import type { Motorcycle } from "@/lib/trailbook";
import { ComponentCard } from "@/components/components/ComponentCard";
import { ComponentSheet } from "@/components/components/ComponentSheet";
import { CheckCircle2, AlertTriangle, Clock, HelpCircle, Heart, ChevronRight, Search } from "lucide-react";
import { TBBottomSheet } from "@/design-system/overlays/TBBottomSheet";
import { Input } from "@/components/ui/input";
import type { ComponentView } from "@/lib/til/components";
import { SingleBadgeChip } from "@/components/badges/BadgeSection";
import { computeReviewState } from "@/lib/review-state";
import { ReviewStateNotice } from "@/components/review-state/ReviewStateNotice";

/**
 * Saúde da Moto — check-up visual do estado atual, alimentado 100% pela TIL.
 * Nada é calculado aqui: leitura direta de `snapshot.health.buckets`.
 */
export function HealthOverview({ moto, isOwner }: { moto: Motorcycle; isOwner: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openBucket, setOpenBucket] = useState<BucketKey | null>(null);
  const [query, setQuery] = useState("");

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
  const reviewState = computeReviewState({ moto: moto as any, schedules: schedules.data ?? [] });
  const grade = health.grade;
  const accent =
    grade === "excellent" ? "text-emerald-400"
    : grade === "good"    ? "text-primary"
    : grade === "attention" ? "text-amber-400"
                            : "text-destructive";
  const GradeIcon = grade === "critical" ? AlertTriangle : grade === "attention" ? Clock : Heart;

  const buckets: Array<{
    key: BucketKey;
    title: string;
    subtitle: string;
    tone: keyof typeof TONE_ACCENT;
    icon: React.ComponentType<{ className?: string }>;
    items: ComponentView[];
    emptyLabel: string;
  }> = [
    { key: "overdue",   title: "Vencidos",         subtitle: "Resolva antes de rodar",           tone: "critical",  icon: AlertTriangle, items: health.buckets.overdue,   emptyLabel: "Nenhum componente vencido" },
    { key: "attention", title: "Merecem atenção",  subtitle: "Planeje a próxima manutenção",     tone: "attention", icon: Clock,         items: health.buckets.attention, emptyLabel: "Nada pendente por enquanto" },
    { key: "noInfo",    title: "Sem informação",   subtitle: "Informe a última manutenção",      tone: "no_info",   icon: HelpCircle,    items: health.buckets.noInfo,    emptyLabel: "Todos já têm histórico" },
    { key: "ok",        title: "Em dia",           subtitle: "Dentro do intervalo previsto",     tone: "ok",        icon: CheckCircle2,  items: health.buckets.ok,        emptyLabel: "—" },
  ];

  const active = buckets.find((b) => b.key === openBucket) ?? null;
  const filtered = active
    ? active.items.filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <SingleBadgeChip motorcycleId={moto.id} badgeId="maintenance_on_track" />
        <SingleBadgeChip motorcycleId={moto.id} badgeId="origin_proven" />
      </div>
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

      {reviewState.isPending && reviewState.state !== "unknown" && (
        <ReviewStateNotice snapshot={reviewState} compact />
      )}

      {/* Cards executáveis — abrem bottom sheet com a categoria */}
      <div className="space-y-2">
        {buckets.map((b) => (
          <BucketCard
            key={b.key}
            title={b.title}
            subtitle={b.subtitle}
            tone={b.tone}
            icon={b.icon}
            count={b.items.length}
            onOpen={() => {
              if (b.items.length === 0) return;
              setQuery("");
              setOpenBucket(b.key);
            }}
          />
        ))}
      </div>

      {/* Bottom sheet da categoria selecionada */}
      <TBBottomSheet
        open={!!active}
        onOpenChange={(v) => !v && setOpenBucket(null)}
        title={active ? `${active.title} (${active.items.length})` : undefined}
        description={active?.subtitle}
      >
        {active && (
          <div className="space-y-3">
            {active.items.length > 5 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar componente…"
                  className="pl-9"
                />
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {query ? "Nenhum resultado." : active.emptyLabel}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <ComponentCard key={c.scheduleId} component={c} onOpen={setSelectedId} />
                ))}
              </div>
            )}
          </div>
        )}
      </TBBottomSheet>

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

type BucketKey = "overdue" | "attention" | "noInfo" | "ok";

const TONE_ACCENT = {
  critical:  { badge: "bg-destructive/10 text-destructive",  ring: "ring-destructive/20" },
  attention: { badge: "bg-amber-500/10 text-amber-400",      ring: "ring-amber-400/20" },
  no_info:   { badge: "bg-muted text-muted-foreground",      ring: "ring-border" },
  ok:        { badge: "bg-emerald-500/10 text-emerald-400",  ring: "ring-emerald-500/20" },
} as const;

function BucketCard({
  title, subtitle, tone, icon: Icon, count, onOpen,
}: {
  title: string;
  subtitle: string;
  tone: keyof typeof TONE_ACCENT;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  onOpen: () => void;
}) {
  const t = TONE_ACCENT[tone];
  const empty = count === 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={empty}
      aria-label={`${title}: ${count}`}
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition ${empty ? "opacity-60" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0"}`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${t.ring} ${t.badge}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {empty ? "Nada aqui ✓" : subtitle}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${t.badge}`}>{count}</span>
      <ChevronRight className={`h-5 w-5 shrink-0 ${empty ? "text-transparent" : "text-muted-foreground"}`} />
    </button>
  );
}