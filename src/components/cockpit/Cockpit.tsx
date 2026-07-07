import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeCockpitSnapshot } from "@/lib/til";
import { HealthHeroWidget } from "./widgets/HealthHeroWidget";
import { QuickStatsWidget } from "./widgets/QuickStatsWidget";
import { NextActionWidget } from "./widgets/NextActionWidget";
import { PageHeader } from "@/components/PageHeader";
import { StoragePhoto } from "@/components/StoragePhoto";

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

      {m.main_photo_url && (
        <StoragePhoto
          path={m.main_photo_url}
          className="h-40 w-full overflow-hidden rounded-2xl sm:h-48"
        />
      )}

      <HealthHeroWidget snapshot={snapshot} />

      <NextActionWidget snapshot={snapshot} moto={m} />

      <QuickStatsWidget snapshot={snapshot} />

      <div className="pt-2">
        <Button asChild variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
          <Link to="/motorcycles/$id/control" params={{ id: m.id }}>
            Abrir Centro de Controle
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}