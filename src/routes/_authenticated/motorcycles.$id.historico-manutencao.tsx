import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Wrench,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory, brl } from "@/lib/trailbook";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);

  // Documentos vinculados por evento via event_documents
  const eventDocs = useQuery({
    queryKey: ["event-docs-map", motoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_documents" as never)
        .select("event_id, motorcycle_documents(id, storage_path, bucket, file_name)")
        .order("created_at", { ascending: false });
      // Monta mapa event_id -> documento
      const map: Record<string, any> = {};
      for (const row of (data ?? []) as any[]) {
        if (!map[row.event_id] && row.motorcycle_documents) {
          map[row.event_id] = row.motorcycle_documents;
        }
      }
      return map;
    },
    staleTime: 30_000,
  });

  async function getDocUrl(storagePath: string, bucket: string): Promise<string | null> {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data?.publicUrl ?? null;
  }

  const events = useQuery({
    queryKey: ["maint-history", motoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, occurred_at, cost, location, description, workshop_id, hours_delta, km_delta, type, metadata, maintenance_items(id, service, category, item_kind, qty, unit_value)",
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
      const inItems = (e.maintenance_items as any[])?.some((it: any) =>
        it.service?.toLowerCase().includes(q),
      );
      return inTitle || inLocal || inItems;
    });
  }, [events.data, search]);

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
                {/* Cabeçalho */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Wrench className="h-4 w-4 text-primary" />
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="min-w-0 flex-1 text-left"
                  >
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
                  </button>
                  {/* Botão ver documento — mostra se há documento próximo da data do evento */}
                  {docs.data &&
                    (() => {
                      const eventDate = new Date(event.occurred_at).getTime();
                      const relatedDoc = docs.data.find((d: any) => {
                        const docDate = new Date(d.created_at).getTime();
                        return Math.abs(docDate - eventDate) < 24 * 60 * 60 * 1000;
                      });
                      if (!relatedDoc) return null;
                      return (
                        <button
                          onClick={() => openDoc(relatedDoc.storage_path, relatedDoc.bucket)}
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                          title="Ver documento"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      );
                    })()}
                  {/* Botão Editar */}
                  <button
                    onClick={() =>
                      navigate({
                        to: "/motorcycles/$id/editar-manutencao" as never,
                        params: { id: motoId } as never,
                        search: { event_id: event.id } as never,
                      })
                    }
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingId(event.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="shrink-0 text-muted-foreground"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                    {items.length > 0 ? (
                      items.map((it: any) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{it.service}</p>
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
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum item registrado.</p>
                    )}
                    {(event.location || event.description) && (
                      <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5 mt-2">
                        {event.location && <p>📍 {event.location}</p>}
                        {event.description && <p>{event.description}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Visor inline de documento — abre na mesma tela sem sair */}
      {viewingDocUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-sm">Documento anexado</h2>
            <button
              onClick={() => setViewingDocUrl(null)}
              className="rounded-lg p-1.5 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {viewingDocUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) ? (
              <img src={viewingDocUrl} alt="Documento" className="h-full w-full object-contain" />
            ) : (
              <iframe src={viewingDocUrl} className="h-full w-full border-0" title="Documento" />
            )}
          </div>
        </div>
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => {
          if (!o) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir manutenção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o registro e recalcula o histórico, agenda e saúde da moto. Não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingId) return;
                try {
                  const { error } = await supabase.rpc(
                    "delete_event_and_recompose" as never,
                    { _event_id: deletingId } as never,
                  );
                  if (error) throw error;
                  await qc.invalidateQueries();
                  toast.success("Manutenção excluída.");
                  setExpandedId(null);
                } catch (err: any) {
                  toast.error("Não foi possível excluir", { description: err.message });
                } finally {
                  setDeletingId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
