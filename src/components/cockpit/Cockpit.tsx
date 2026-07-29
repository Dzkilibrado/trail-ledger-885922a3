import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertTriangle, Heart, Wrench, FolderOpen, Camera, Sparkles, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeCockpitSnapshot } from "@/lib/til";
import { HealthHeroWidget } from "./widgets/HealthHeroWidget";
import { QuickStatsWidget } from "./widgets/QuickStatsWidget";
import { NextActionWidget } from "./widgets/NextActionWidget";
import { PageHeader } from "@/components/PageHeader";
import { StoragePhoto } from "@/components/StoragePhoto";
import { useActiveMotorcycle } from "@/hooks/useActiveMotorcycle";

/**
 * TrailBook Cockpit — centro da experiência.
 *
 * Regras oficiais (ADR 0002):
 * - Interface enxuta: hero de saúde + resumo rápido + próxima ação.
 * - Nenhum cálculo aqui — tudo vem do snapshot da TIL.
 * - Mobile-first; desktop é apenas adaptação centralizada.
 */
export function Cockpit({ motoId }: { motoId: string }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { setActiveId } = useActiveMotorcycle();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);
  const moto = useQuery({
    queryKey: ["motorcycle", motoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("*").eq("id", motoId).single();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events", motoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("motorcycle_id", motoId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const schedules = useQuery({
    queryKey: ["schedules", motoId],
    queryFn: async () =>
      (await supabase.from("maintenance_schedules").select("*").eq("motorcycle_id", motoId)).data ?? [],
  });

  const attachments = useQuery({
    queryKey: ["attachments", motoId],
    queryFn: async () => {
      const ids = (events.data ?? []).map((e) => e.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("event_attachments").select("*").in("event_id", ids);
      return data ?? [];
    },
    enabled: !!events.data,
  });

  const isOwner = !!moto.data && !!currentUserId && (moto.data as any).owner_id === currentUserId;

  useEffect(() => {
    if (moto.data && (moto.data as any).status !== "archived") setActiveId(moto.data.id);
  }, [moto.data, setActiveId]);

  const snapshot = useMemo(() => {
    if (!moto.data || !events.data || !schedules.data) return null;
    return computeCockpitSnapshot({
      moto: moto.data,
      events: events.data,
      schedules: schedules.data,
      attachments: attachments.data ?? [],
      isOwner,
    });
  }, [moto.data, events.data, schedules.data, attachments.data, isOwner]);

  if (moto.isLoading || !snapshot || !moto.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="surface-elevated h-56 animate-pulse rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!moto.data) {
    return (
      <div className="surface-elevated mx-auto max-w-md rounded-2xl p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 font-display text-xl font-bold">Moto não encontrada</h2>
      </div>
    );
  }

  const m = moto.data;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title={m.nickname || m.model}
        crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: m.nickname || m.model }]}
      />

      {m.main_photo_url ? (
        <StoragePhoto
          path={m.main_photo_url}
          className="h-40 w-full overflow-hidden rounded-2xl sm:h-48"
        />
      ) : (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-3 sm:p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Camera className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Adicione uma foto da sua moto</div>
            <div className="truncate text-xs text-muted-foreground">
              Personaliza sua garagem e facilita a identificação.
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/motorcycles/$id/control" params={{ id: m.id }}>Adicionar</Link>
          </Button>
        </div>
      )}

      {/* Saudação contextual — vinda da TIL */}
      <div className="flex items-start gap-2 rounded-2xl bg-primary/5 px-4 py-3 text-sm text-foreground/90 animate-fade-in">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="leading-snug">{snapshot.greeting}</p>
      </div>

      <HealthHeroWidget snapshot={snapshot} />

      {/* Card dinâmico de prioridade — aparece só quando há pendência */}
      <NextActionWidget snapshot={snapshot} moto={m} />

      <QuickStatsWidget snapshot={snapshot} />

      {/* Áreas principais da moto — não menus */}
      <nav aria-label="Áreas da moto" className="space-y-3 pt-2">
        <ActionCard
          to="/motorcycles/$id/health"
          params={{ id: m.id }}
          icon={<Heart className="h-5 w-5 text-rose-400" />}
          title="Check-up Completo"
          description="Diagnóstico completo da motocicleta"
        />
        <ActionCard
          to="/motorcycles/$id/components"
          params={{ id: m.id }}
          icon={<Wrench className="h-5 w-5 text-primary" />}
          title="Componentes"
          description="Plano de manutenção e componentes"
        />
        <ActionCard
          to="/motorcycles/$id/checkups"
          params={{ id: m.id }}
          icon={<Stethoscope className="h-5 w-5 text-sky-400" />}
          title="Check-ups e Laudos"
          description="Emita e compartilhe o laudo da sua moto"
        />
        <ActionCard
          to="/motorcycles/$id/control"
          params={{ id: m.id }}
          icon={<FolderOpen className="h-5 w-5 text-amber-400" />}
          title="Central da Moto"
          description="Documentos, histórico, certificados e informações"
        />
      </nav>
    </div>
  );
}

function ActionCard({
  to,
  params,
  icon,
  title,
  description,
}: {
  to: string;
  params: Record<string, string>;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to as any}
      params={params as any}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-md active:translate-y-0 active:bg-accent/60 sm:p-5"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold sm:text-base">{title}</div>
        <div className="truncate text-xs text-muted-foreground sm:text-sm">{description}</div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}