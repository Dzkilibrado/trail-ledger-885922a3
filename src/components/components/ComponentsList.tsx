import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCockpitSnapshot } from "@/lib/til";
import type { Motorcycle } from "@/lib/trailbook";
import { groupComponentsByCategory } from "@/lib/til/components";
import { ComponentCard } from "./ComponentCard";
import { ComponentSheet } from "./ComponentSheet";
import { PlanCatalogSyncDialog } from "@/components/PlanCatalogSyncDialog";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";

/**
 * Lista de COMPONENTES da moto — agrupada por categoria,
 * ordenada por prioridade dentro de cada grupo.
 * Todas as informações vêm do snapshot da TIL (nada calculado aqui).
 */
export function ComponentsList({ moto, isOwner, limitPerCategory }: {
  moto: Motorcycle;
  isOwner: boolean;
  limitPerCategory?: number;
}) {
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

  const snapshot = useMemo(() => {
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

  const groups = useMemo(() => snapshot ? groupComponentsByCategory(snapshot.components) : [], [snapshot]);
  const selected = useMemo(
    () => snapshot?.components.find((c) => c.scheduleId === selectedId) ?? null,
    [snapshot, selectedId],
  );

  if (!snapshot) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }

  if (snapshot.components.length === 0) {
    return (
      <div className="surface-elevated space-y-3 rounded-2xl p-6 text-center">
        <div className="text-sm font-medium">Nenhum componente cadastrado ainda</div>
        <p className="text-xs text-muted-foreground">
          Aplique o plano recomendado do catálogo para começar a acompanhar cada componente da sua moto.
        </p>
        {isOwner && (
          <div className="flex justify-center pt-1">
            <PlanCatalogSyncDialog
              moto={moto}
              trigger={
                <Button className="btn-glow" size="sm">
                  <Wand2 className="h-4 w-4" /> Aplicar plano recomendado
                </Button>
              }
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {groups.map((g) => {
          const visible = limitPerCategory ? g.items.slice(0, limitPerCategory) : g.items;
          return (
            <div key={g.category} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g.label}</h3>
                <span className="text-[10px] text-muted-foreground">{g.items.length}</span>
              </div>
              <div className="space-y-2">
                {visible.map((c) => (
                  <ComponentCard key={c.scheduleId} component={c} onOpen={setSelectedId} />
                ))}
                {limitPerCategory && g.items.length > limitPerCategory && (
                  <div className="pl-1 text-[11px] text-muted-foreground">+{g.items.length - limitPerCategory} outros</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ComponentSheet
        moto={moto}
        component={selected}
        open={!!selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
        isOwner={isOwner}
      />
    </>
  );
}