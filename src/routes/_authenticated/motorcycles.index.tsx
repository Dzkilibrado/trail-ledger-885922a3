import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoragePhoto } from "@/components/StoragePhoto";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { MotoGridSkeleton } from "@/components/Skeletons";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/motorcycles/")({
  head: () => ({ meta: [{ title: "Motos — TrailBook" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "archived" ? "archived" : "active",
  }),
  component: MotorcyclesList,
});

function MotorcyclesList() {
  const initial = Route.useSearch().tab as "active" | "archived";
  const [tab, setTab] = useState<"active" | "archived">(initial);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase.from("motorcycles").select("*").eq("owner_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const active = (data ?? []).filter((m: any) => (m.status ?? "active") === "active");
  const archived = (data ?? []).filter((m: any) => m.status === "archived");
  const list = tab === "active" ? active : archived;

  async function restore(id: string) {
    const { error } = await supabase.rpc("unarchive_motorcycle" as never, { _moto_id: id } as never);
    if (error) { toast.error("Falha ao reativar", { description: error.message }); return; }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["motorcycles"] }),
      qc.invalidateQueries({ queryKey: ["motorcycles-archived-count"] }),
      qc.invalidateQueries({ queryKey: ["document-pendencies"] }),
    ]);
    toast.success("Motocicleta reativada");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Suas motos</h1>
        <Link to="/motorcycles/new"><Button className="btn-glow"><Plus className="h-4 w-4" /> Nova moto</Button></Link>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
        <TabsList>
          <TabsTrigger value="active">Ativas ({active.length})</TabsTrigger>
          <TabsTrigger value="archived"><Archive className="mr-1 h-3.5 w-3.5" /> Arquivadas ({archived.length})</TabsTrigger>
        </TabsList>
      </Tabs>
      {isLoading ? <MotoGridSkeleton /> : (
        list.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((m: any) => (
              <div key={m.id} className="surface-elevated group relative overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5">
                {m.status === "archived" && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur">
                    Arquivada
                  </span>
                )}
                <Link to="/motorcycles/$id" params={{ id: m.id }} className="block">
                  <StoragePhoto path={m.main_photo_url} className="h-44 w-full" />
                  <div className="p-4">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{m.brand} · {m.year_model || "—"}</div>
                    <div className="font-display text-lg font-bold">{m.nickname || m.model}</div>
                    <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                      <span>{Number(m.hours_total).toFixed(1)} h</span>
                      <span>{Number(m.km_total).toFixed(0)} km</span>
                    </div>
                  </div>
                </Link>
                {m.status === "archived" && (
                  <div className="border-t border-border p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => restore(m.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reativar motocicleta
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="surface-elevated rounded-2xl p-10 text-center text-muted-foreground">
            {tab === "active" ? "Você não possui motos ativas na garagem." : "Nenhuma motocicleta arquivada."}
          </div>
        )
      )}
    </div>
  );
}