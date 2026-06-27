import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StoragePhoto } from "@/components/StoragePhoto";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { NewEventDialog } from "@/components/NewEventDialog";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { Button } from "@/components/ui/button";
import { Trash2, QrCode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/motorcycles/$id")({
  head: () => ({ meta: [{ title: "Moto — TrailBook" }] }),
  component: MotoDetail,
});

function MotoDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("motorcycle_id", id).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function genCertificate() {
    const { data, error } = await supabase.from("certificates").insert({ motorcycle_id: id }).select("public_token").single();
    if (error) return toast.error(error.message);
    const url = `${window.location.origin}/c/${data.public_token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Certificado criado! Link copiado.");
    qc.invalidateQueries({ queryKey: ["certificates"] });
  }

  async function removeMoto() {
    if (!confirm("Excluir esta moto e todo o histórico?")) return;
    const { error } = await supabase.from("motorcycles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moto removida");
    navigate({ to: "/motorcycles" });
  }

  if (moto.isLoading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!moto.data) return <div>Moto não encontrada.</div>;

  const m = moto.data;
  const totalCost = events.data?.reduce((s, e) => s + (Number(e.cost) || 0), 0) ?? 0;

  return (
    <div className="space-y-8">
      <div className="surface-elevated overflow-hidden rounded-2xl">
        <div className="grid md:grid-cols-[280px_1fr]">
          <StoragePhoto path={m.main_photo_url} className="h-56 w-full md:h-full" />
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{m.brand} · {m.year_model || m.year_make || ""}</div>
                <h1 className="font-display text-3xl font-bold">{m.nickname || m.model}</h1>
                <div className="mt-1 text-sm text-muted-foreground">{m.model}{m.displacement ? ` · ${m.displacement}cc` : ""}{m.plate ? ` · ${m.plate}` : ""}</div>
              </div>
              <div className="rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary">{m.conservation_score}/100 conservação</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Horas" value={`${Number(m.hours_total).toFixed(1)} h`} />
              <Stat label="Km" value={Number(m.km_total).toFixed(0)} />
              <Stat label="Investido" value={brl(totalCost)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <NewEventDialog moto={m} />
              <Button variant="outline" onClick={genCertificate}><QrCode className="h-4 w-4" /> Gerar certificado</Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={removeMoto}><Trash2 className="h-4 w-4" /> Excluir</Button>
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-4 font-display text-lg font-bold">Linha do tempo</h2>
        {events.isLoading ? (
          <div className="text-muted-foreground">Carregando…</div>
        ) : events.data && events.data.length > 0 ? (
          <ol className="relative space-y-4 border-l border-border pl-6">
            {events.data.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[34px] top-2 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="surface-elevated rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <EventTypeIcon type={e.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-semibold">{e.title}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(e.occurred_at)}</div>
                      </div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">{EVENT_TYPE_LABEL[e.type]}</div>
                      {e.description && <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {e.hours_at_event != null && <span>{Number(e.hours_at_event).toFixed(1)} h</span>}
                        {e.km_at_event != null && <span>{Number(e.km_at_event).toFixed(0)} km</span>}
                        {e.location && <span>{e.location}</span>}
                        {e.cost != null && <span className="font-semibold text-primary">{brl(Number(e.cost))}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="surface-elevated rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Nenhum evento registrado ainda. Clique em <strong>Novo evento</strong> para começar.
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}