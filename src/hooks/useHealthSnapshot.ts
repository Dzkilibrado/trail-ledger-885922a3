import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCockpitSnapshot, type CockpitSnapshot } from "@/lib/til";
import type { Motorcycle } from "@/lib/trailbook";

/**
 * Fonte única de leitura para Saúde / Check-up / Laudo.
 * NÃO calcula nada: apenas coleta os dados e delega à TIL.
 */
export function useHealthSnapshot(motoId: string, uid: string | null) {
  const moto = useQuery({
    queryKey: ["motorcycle", motoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("*").eq("id", motoId).single();
      if (error) throw error;
      return data as Motorcycle;
    },
  });

  const events = useQuery({
    queryKey: ["events", motoId],
    queryFn: async () =>
      (
        await supabase
          .from("events")
          .select("*")
          .eq("motorcycle_id", motoId)
          .order("occurred_at", { ascending: false })
      ).data ?? [],
  });

  const schedules = useQuery({
    queryKey: ["schedules", motoId],
    queryFn: async () =>
      (await supabase.from("maintenance_schedules").select("*").eq("motorcycle_id", motoId)).data ?? [],
  });

  const eventIds = (events.data ?? []).map((e) => e.id);

  const attachments = useQuery({
    queryKey: ["attachments", motoId, eventIds.length],
    queryFn: async () => {
      if (eventIds.length === 0) return [];
      return (await supabase.from("event_attachments").select("*").in("event_id", eventIds)).data ?? [];
    },
    enabled: !!events.data,
  });

  const items = useQuery({
    queryKey: ["maintenance-items", motoId, eventIds.length],
    queryFn: async () => {
      if (eventIds.length === 0) return [];
      return (
        (await supabase.from("maintenance_items").select("event_id, schedule_id, created_at").in("event_id", eventIds))
          .data ?? []
      );
    },
    enabled: !!events.data,
  });

  const inspections = useQuery({
    queryKey: ["maintenance-inspections", motoId],
    queryFn: async () =>
      (
        await supabase
          .from("maintenance_inspections")
          .select("schedule_id, created_at, decision, notes")
          .eq("motorcycle_id", motoId)
      ).data ?? [],
  });

  const isOwner = !!moto.data && !!uid && (moto.data as any).owner_id === uid;

  const snapshot: CockpitSnapshot | null = useMemo(() => {
    if (!moto.data || !events.data || !schedules.data) return null;
    return computeCockpitSnapshot({
      moto: moto.data as never,
      events: events.data,
      schedules: schedules.data,
      attachments: attachments.data ?? [],
      maintenanceItems: items.data ?? [],
      inspections: (inspections.data ?? []) as never,
      isOwner,
    });
  }, [moto.data, events.data, schedules.data, attachments.data, items.data, inspections.data, isOwner]);

  const maxRecordedHours = useMemo(() => {
    const list = (events.data ?? []).map((e) => Number(e.hours_at_event ?? 0)).filter((n) => n > 0);
    return list.length ? Math.max(...list) : null;
  }, [events.data]);

  const maxRecordedKm = useMemo(() => {
    const list = (events.data ?? []).map((e) => Number(e.km_at_event ?? 0)).filter((n) => n > 0);
    return list.length ? Math.max(...list) : null;
  }, [events.data]);

  return {
    moto: (moto.data ?? null) as Motorcycle | null,
    events: events.data ?? [],
    inspections: (inspections.data ?? []) as Array<{ created_at: string; decision: string; notes: string | null }>,
    snapshot,
    isOwner,
    maxRecordedHours,
    maxRecordedKm,
    isLoading: moto.isLoading || events.isLoading || schedules.isLoading,
    error: (moto.error || events.error || schedules.error) as Error | null,
    refetch: () => {
      void moto.refetch();
      void events.refetch();
      void schedules.refetch();
      void inspections.refetch();
    },
  };
}