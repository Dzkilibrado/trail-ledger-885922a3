import { EvaluationPill } from "@/components/health/EvaluationPill";
import { stateFromScore } from "@/lib/ui/evaluation";
import { Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { StoragePhoto } from "@/components/StoragePhoto";
import { TBBottomSheet } from "@/design-system/overlays/TBBottomSheet";
import { useActiveMotorcycle, type ActiveMotorcycle } from "@/hooks/useActiveMotorcycle";
import { Bike, Check, ChevronRight, Repeat } from "lucide-react";

/**
 * Cartão da Moto Ativa — foco da home mobile-first.
 * Mostra apenas UMA moto por vez com CTA "Trocar moto" em bottom sheet.
 */
export function ActiveMotoCard({ motos }: { motos: ActiveMotorcycle[] }) {
  const { activeId, activeMoto, setActiveId } = useActiveMotorcycle();
  const [open, setOpen] = useState(false);

  const active = useMemo(() => {
    if (motos.length === 0) return null;
    return motos.find((m) => m.id === activeMoto?.id) ?? motos.find((m) => m.id === activeId) ?? motos[0];
  }, [motos, activeId, activeMoto?.id]);

  if (!active) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Minha moto ativa
        </h2>
        {motos.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setOpen(true)}
          >
            <Repeat className="h-3.5 w-3.5" /> Trocar moto
          </Button>
        )}
      </div>

      <Link
        to="/motorcycles/$id"
        params={{ id: active.id }}
        className="surface-elevated group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl p-3 transition-colors hover:bg-accent/30 sm:p-4"
      >
        {active.main_photo_url ? (
          <StoragePhoto
            path={active.main_photo_url}
            className="h-16 w-16 shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-20"
          />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground sm:h-20 sm:w-20">
            <Bike className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-bold sm:text-xl">
            {active.nickname || active.model || "Motocicleta"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[active.brand, active.model].filter(Boolean).join(" · ") || "Moto ativa"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <EvaluationPill state={stateFromScore(active.conservation_score)} size="sm" />
            <span className="text-muted-foreground">
              {Number(active.hours_total).toFixed(1)} h
            </span>
            <span className="text-muted-foreground">
              {Number(active.km_total).toFixed(0)} km
            </span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      <TBBottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Trocar moto ativa"
        description="Selecione qual moto será o foco do TrailBook."
      >
        <ul className="space-y-2">
          {motos.map((m) => {
            const isActive = m.id === active.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(m.id);
                    setOpen(false);
                  }}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-accent/40"
                  }`}
                >
                  {m.main_photo_url ? (
                    <StoragePhoto
                      path={m.main_photo_url}
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"
                    />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Bike className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {m.nickname || m.model}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.brand || "Moto"} ·{" "}
                      {Number(m.hours_total).toFixed(1)} h ·{" "}
                      {Number(m.km_total).toFixed(0)} km
                    </div>
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      <Check className="h-3 w-3" /> Ativa
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </TBBottomSheet>
    </section>
  );
}