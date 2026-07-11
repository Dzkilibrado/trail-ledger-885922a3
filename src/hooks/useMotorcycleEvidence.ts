import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCockpitSnapshot } from "@/lib/til";
import type { EvidenceSnapshot } from "@/lib/badges";
import type { DocType } from "@/lib/motorcycle-documents";

/**
 * Monta o `EvidenceSnapshot` a partir dos dados que já existem no banco.
 * Nenhuma tabela nova é criada — os selos são apenas uma leitura derivada.
 *
 * A avaliação real é feita em `useMotorcycleBadges`.
 */
export function useMotorcycleEvidence(motorcycleId: string | undefined) {
  const enabled = !!motorcycleId;

  const moto = useQuery({
    enabled,
    queryKey: ["motorcycle", motorcycleId],
    queryFn: async () =>
      (await supabase.from("motorcycles").select("*").eq("id", motorcycleId!).single()).data,
  });

  const documents = useQuery({
    enabled,
    queryKey: ["motorcycle-documents", motorcycleId],
    queryFn: async () =>
      (await supabase
        .from("motorcycle_documents" as never)
        .select("*")
        .eq("motorcycle_id", motorcycleId!)).data ?? [],
  });

  const events = useQuery({
    enabled,
    queryKey: ["events", motorcycleId],
    queryFn: async () =>
      (await supabase
        .from("events")
        .select("*")
        .eq("motorcycle_id", motorcycleId!)
        .order("occurred_at", { ascending: true })).data ?? [],
  });

  const schedules = useQuery({
    enabled,
    queryKey: ["schedules", motorcycleId],
    queryFn: async () =>
      (await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("motorcycle_id", motorcycleId!)).data ?? [],
  });

  const attachments = useQuery({
    enabled: enabled && !!events.data,
    queryKey: ["attachments", motorcycleId],
    queryFn: async () => {
      const ids = (events.data ?? []).map((e) => e.id);
      if (ids.length === 0) return [];
      return (await supabase.from("event_attachments").select("*").in("event_id", ids)).data ?? [];
    },
  });

  const items = useQuery({
    enabled: enabled && !!events.data,
    queryKey: ["maintenance-items", motorcycleId],
    queryFn: async () => {
      const ids = (events.data ?? []).map((e) => e.id);
      if (ids.length === 0) return [];
      return (
        (await supabase
          .from("maintenance_items")
          .select("event_id, schedule_id, created_at")
          .in("event_id", ids)).data ?? []
      );
    },
  });

  const ownership = useQuery({
    enabled,
    queryKey: ["ownership", motorcycleId],
    queryFn: async () =>
      (await supabase
        .from("ownership_history")
        .select("id, owner_id, started_at, ended_at")
        .eq("motorcycle_id", motorcycleId!)
        .order("started_at", { ascending: true })).data ?? [],
  });

  const photos = useQuery({
    enabled,
    queryKey: ["motorcycle_photos", motorcycleId],
    queryFn: async () =>
      (await supabase
        .from("motorcycle_photos")
        .select("id, is_primary")
        .eq("motorcycle_id", motorcycleId!)).data ?? [],
  });

  const evidence = useMemo<EvidenceSnapshot | null>(() => {
    if (!motorcycleId) return null;
    if (!moto.data || !documents.data || !events.data || !schedules.data || !ownership.data || !photos.data) return null;

    // ==== Documentos ====
    const activeByType: Partial<Record<DocType, number>> = {};
    let activeTotal = 0;
    let hasOriginDocument = false;
    for (const d of documents.data as Array<Record<string, unknown>>) {
      if (d["deleted_at"] || !d["is_current"]) continue;
      const t = d["doc_type"] as DocType;
      activeByType[t] = (activeByType[t] ?? 0) + 1;
      activeTotal++;
      if (d["is_origin_document"]) hasOriginDocument = true;
    }

    // ==== Timeline ====
    const evs = events.data;
    const firstEventAt = evs[0]?.occurred_at ?? null;
    const lastEventAt = evs[evs.length - 1]?.occurred_at ?? null;

    // ==== Manutenção (via TIL — telas nunca calculam) ====
    const snapshot = computeCockpitSnapshot({
      moto: moto.data as never,
      events: evs as never,
      schedules: schedules.data as never,
      attachments: (attachments.data ?? []) as never,
      maintenanceItems: (items.data ?? []) as never,
      isOwner: true, // avaliação de saúde é objetiva; owner só filtra visibilidade
    });
    const grade = snapshot.health.grade;
    const overdueCount = snapshot.health.buckets.overdue.length;
    const attentionCount = snapshot.health.buckets.attention.length;
    const hasComponents = snapshot.components.length > 0;

    // ==== Propriedade ====
    const owns = ownership.data as Array<{ ended_at: string | null }>;
    const entries = owns.length;
    const hasOpenCurrentOwner = owns.some((o) => o.ended_at == null);
    // Uma lacuna é definida quando uma entrada é fechada (ended_at) mas a
    // próxima não existe / não tem started_at coerente.
    let gaps = 0;
    for (let i = 0; i < owns.length - 1; i++) {
      if (owns[i].ended_at == null) continue; // ainda aberta — próximo não deveria existir
      // Se a próxima entrada não começa, conta gap.
      const next = owns[i + 1] as { started_at?: string | null };
      if (!next?.started_at) gaps++;
    }

    // ==== Fotos ====
    const photoRows = photos.data as Array<{ is_primary: boolean }>;
    const total = photoRows.length;
    const hasCover = photoRows.some((p) => p.is_primary);

    return {
      motoId: motorcycleId,
      documents: { activeByType, hasOriginDocument, activeTotal },
      timeline: { eventCount: evs.length, firstEventAt, lastEventAt },
      maintenance: { overdueCount, attentionCount, grade, hasComponents },
      ownership: { entries, hasOpenCurrentOwner, gaps },
      photos: { total, hasCover },
    };
  }, [motorcycleId, moto.data, documents.data, events.data, schedules.data, attachments.data, items.data, ownership.data, photos.data]);

  const isLoading =
    moto.isLoading || documents.isLoading || events.isLoading ||
    schedules.isLoading || ownership.isLoading || photos.isLoading;

  return { evidence, isLoading };
}