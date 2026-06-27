import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoragePhoto } from "@/components/StoragePhoto";

export const Route = createFileRoute("/_authenticated/motorcycles/")({
  head: () => ({ meta: [{ title: "Motos — TrailBook" }] }),
  component: MotorcyclesList,
});

function MotorcyclesList() {
  const { data, isLoading } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Suas motos</h1>
        <Link to="/motorcycles/new"><Button className="btn-glow"><Plus className="h-4 w-4" /> Nova moto</Button></Link>
      </div>
      {isLoading ? <div className="text-muted-foreground">Carregando…</div> : (
        data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((m) => (
              <Link key={m.id} to="/motorcycles/$id" params={{ id: m.id }} className="surface-elevated group overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5">
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
            ))}
          </div>
        ) : (
          <div className="surface-elevated rounded-2xl p-10 text-center text-muted-foreground">
            Você ainda não cadastrou nenhuma moto.
          </div>
        )
      )}
    </div>
  );
}