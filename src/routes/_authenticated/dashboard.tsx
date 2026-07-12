import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronDown, ChevronUp, Bike, Share2, ShieldCheck, FileSignature, Award, FolderOpen, Heart, Wrench, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoragePhoto } from "@/components/StoragePhoto";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { EVENT_TYPE_LABEL, formatDate, brl } from "@/lib/trailbook";
import { ActiveMotoCard } from "@/components/ActiveMotoCard";
import { DocumentPendenciesCard } from "@/components/DocumentPendenciesCard";
import { WhatsNewCard } from "@/components/WhatsNewCard";
import { useActiveMotorcycle } from "@/hooks/useActiveMotorcycle";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP } from "@/lib/help/texts";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Início — TrailBook" },
    { name: "description", content: "Seu painel do TrailBook: motos, pendências, novidades e atalhos rápidos." },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const [showAll, setShowAll] = useState(false);
  const { activeId } = useActiveMotorcycle();
  const motos = useQuery({
    queryKey: ["motorcycles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase.from("motorcycles").select("*").eq("owner_id", uid).eq("status" as never, "active" as never).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, motorcycles(nickname, brand, model)")
        .order("occurred_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  // Prioridade: moto ativa; fallback: primeira moto.
  const focusMotoId = activeId && motos.data?.some((m) => m.id === activeId)
    ? activeId
    : motos.data?.[0]?.id ?? null;

  if (motos.isLoading) return <div className="text-muted-foreground">Carregando…</div>;

  if ((motos.data?.length ?? 0) === 0) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <h2 className="font-display text-2xl font-bold">Bem-vindo ao TrailBook</h2>
        <p className="mt-2 text-muted-foreground">Cadastre sua primeira moto para começar o histórico.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/motorcycles/new">
            <Button className="btn-glow"><Plus className="h-4 w-4" /> Cadastrar moto</Button>
          </Link>
          <Link to="/como-funciona">
            <Button variant="outline"><HelpCircle className="h-4 w-4" /> Como funciona</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Ordem Sprint v1.6 (polimento):
          Moto ativa → Pendências → Atalhos → Últimas atividades → Novidades.
          "Investido" já aparece no card da moto ativa; métrica duplicada removida. */}
      <ActiveMotoCard motos={motos.data as any} />

      <DocumentPendenciesCard />

      {focusMotoId && <QuickActions motoId={focusMotoId} />}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Últimas atualizações</h2>
        <div className="surface-elevated divide-y divide-border rounded-2xl">
          {events.data && events.data.length > 0 ? events.data.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-4">
              <EventTypeIcon type={e.type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {EVENT_TYPE_LABEL[e.type]} · {formatDate(e.occurred_at)}
                  {e.motorcycles && ` · ${(e.motorcycles as any).nickname || (e.motorcycles as any).model}`}
                </div>
              </div>
              {e.cost != null && <div className="shrink-0 text-sm font-semibold text-primary">{brl(Number(e.cost))}</div>}
            </div>
          )) : (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem atividades ainda. Registre a primeira na página da moto.</div>
          )}
        </div>
      </section>

      {(motos.data?.length ?? 0) > 1 && (
        <section>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-accent/40"
          >
            <span>Suas motos ({motos.data!.length})</span>
            {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showAll && (
            <ul className="mt-3 space-y-2">
              {motos.data!.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/motorcycles/$id"
                    params={{ id: m.id }}
                    className="surface-elevated grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-accent/30"
                  >
                    {m.main_photo_url ? (
                      <StoragePhoto path={m.main_photo_url} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg" />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Bike className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{m.nickname || m.model}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.brand} · {Number(m.hours_total).toFixed(1)} h · {Number(m.km_total).toFixed(0)} km
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">{m.conservation_score}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <WhatsNewCard />
    </div>
  );
}

function QuickActions({ motoId }: { motoId: string }) {
  const items = [
    { to: "/motorcycles/$id/passport", icon: Share2, label: "Passaporte" },
    { to: "/motorcycles/$id/control", icon: ShieldCheck, label: "Documentos" },
    { to: "/motorcycles/$id/control", icon: FileSignature, label: "Recibo" },
    { to: "/motorcycles/$id/passport", icon: Award, label: "Selos" },
    { to: "/motorcycles/$id/health", icon: Heart, label: "Saúde" },
    { to: "/motorcycles/$id/plan", icon: Wrench, label: "Manutenções" },
    { to: "/motorcycles/$id", icon: FolderOpen, label: "Cockpit" },
  ] as const;
  return (
    <section aria-label="Atalhos rápidos">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Atalhos</h2>
        <HelpTooltip label="Atalhos" text={HELP.quickShortcuts} />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.label + it.to}
            to={it.to as any}
            params={{ id: motoId } as any}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <it.icon className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-semibold leading-tight sm:text-xs">{it.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="surface-elevated rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="font-display text-xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}