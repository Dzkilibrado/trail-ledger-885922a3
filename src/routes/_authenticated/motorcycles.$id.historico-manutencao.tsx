import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Wrench, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory, brl } from "@/lib/trailbook";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/historico-manutencao")({
  head: () => ({ meta: [{ title: "Histórico de manutenções — TrailBook" }] }),
  component: HistoricoManutencao,
});

const CATEGORY_ICON: Record<MaintenanceCategory, string> = {
  engine: "🔧",
  transmission: "⛓",
  brakes: "🛑",
  suspension: "🔩",
  wheels: "🛞",
  electrical: "⚡",
  cooling: "🌡",
  other: "🔩",
};

function HistoricoManutencao() {
  const { id: motoId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Eventos de manutenção com seus itens
  const events = useQuery({
    queryKey: ["maint-history", motoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id, title, occurred_at, cost, location, description, workshop_id,
          maintenance_items (id, service, category, item_kind, qty, unit_value)
        `,
        )
        .eq("motorcycle_id", motoId)
        .in("type", ["maintenance", "revision"])
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const moto = useQuery({
    queryKey: ["motorcycle", motoId, "basic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("motorcycles")
        .select("nickname, model, brand")
        .eq("id", motoId)
        .single();
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return events.data ?? [];
    const q = search.toLowerCase();
    return (events.data ?? []).filter((e) => {
      const inTitle = e.title?.toLowerCase().includes(q);
      const inLocal = e.location?.toLowerCase().includes(q);
      const inItems = (e.maintenance_items as any[])?.some((it) =>
        it.service?.toLowerCase().includes(q),
      );
      return inTitle || inLocal || inItems;
    });
  }, [events.data, search]);

  async function deleteEvent(eventId: string) {
    if (deleting) return;
    setDeleting(eventId);
    try {
      const { error } = await supabase.rpc(
        "delete_event_and_recompose" as never,
        {
          _event_id: eventId,
          _moto_id: motoId,
        } as never,
      );
      if (error) throw error;
      await qc.invalidateQueries();
      toast.success("Manutenção excluída.");
      setExpandedId(null);
    } catch (err: any) {
      toast.error("Não foi possível excluir", { description: err.message });
    } finally {
      setDeleting(null);
    }
  }

  const motoName = moto.data?.nickname || moto.data?.model || "Moto";

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            navigate({
              to: "/motorcycles/$id/registrar-manutencao" as never,
              params: { id: motoId } as never,
            })
          }
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold">Histórico de manutenções</h1>
          <p className="text-sm text-muted-foreground">{motoName}</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar: pneu, corrente, óleo, local…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Resultado da busca */}
      {search && (
        <p className="text-xs text-muted-foreground">
          {filtered.length === 0
            ? "Nenhuma manutenção encontrada"
            : `${filtered.length} manutenção${filtered.length > 1 ? "ões" : ""} encontrada${filtered.length > 1 ? "s" : ""}`}
        </p>
      )}

      {/* Lista */}
      {events.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 && !search ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Wrench className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada ainda.</p>
          <Button
            className="mt-4 btn-glow"
            onClick={() =>
              navigate({
                to: "/motorcycles/$id/registrar-manutencao" as never,
                params: { id: motoId } as never,
              })
            }
          >
            Registrar primeira manutenção
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const items = (event.maintenance_items as any[]) ?? [];
            const isExpanded = expandedId === event.id;
            const date = new Date(event.occurred_at);

            return (
              <div
                key={event.id}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* Cabeçalho do evento */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30 transition"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Wrench className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {date.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {event.cost ? ` · ${brl(event.cost)}` : ""}
                      {items.length > 0
                        ? ` · ${items.length} item${items.length > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {/* Itens */}
                    {items.length > 0 && (
                      <div className="space-y-1.5">
                        {items.map((it: any) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate">{it.service}</p>
                              <p className="text-xs text-muted-foreground">
                                {CATEGORY_ICON[it.category as MaintenanceCategory]}{" "}
                                {MAINT_CATEGORY_LABEL[it.category as MaintenanceCategory]}
                                {it.item_kind === "labor" ? " · Mão de obra" : ""}
                              </p>
                            </div>
                            {it.unit_value && (
                              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                {it.qty ? `${it.qty}x ` : ""}R$ {Number(it.unit_value).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Local / observações */}
                    {(event.location || event.description) && (
                      <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                        {event.location && <p>📍 {event.location}</p>}
                        {event.description && <p>{event.description}</p>}
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        disabled={deleting === event.id}
                        onClick={() => deleteEvent(event.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {deleting === event.id ? "Excluindo…" : "Excluir"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
