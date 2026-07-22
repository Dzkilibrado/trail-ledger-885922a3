import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ChevronDown, ChevronUp, Bike, Share2, ShieldCheck, FileSignature, Award, FolderOpen, Heart, Wrench, HelpCircle, CheckCircle2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoragePhoto } from "@/components/StoragePhoto";
import { ActiveMotoCard } from "@/components/ActiveMotoCard";
import { DocumentPendenciesCard } from "@/components/DocumentPendenciesCard";
import { WhatsNewCard } from "@/components/WhatsNewCard";
import { useActiveMotorcycle, useArchivedMotorcyclesCount } from "@/hooks/useActiveMotorcycle";
import { useDocumentPendencies } from "@/hooks/useDocumentPendencies";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP } from "@/lib/help/texts";
import { memo, useState } from "react";
import { DashboardSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Início — TrailBook" },
    { name: "description", content: "Seu painel do TrailBook: motos, pendências, novidades e atalhos rápidos." },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const [showAll, setShowAll] = useState(false);
  const { activeId, activeMotos, isLoading } = useActiveMotorcycle();
  const pendencies = useDocumentPendencies();
  const motos = activeMotos;
  // Conta motos arquivadas para orientar o usuário quando a garagem estiver vazia.
  const archivedCount = useArchivedMotorcyclesCount();

  // Fonte oficial do Dashboard: useActiveMotorcycle valida o localStorage
  // contra a lista ativa do banco e limpa automaticamente motos arquivadas.
  const focusMotoId = activeId;

  if (isLoading) return <DashboardSkeleton />;

  if (motos.length === 0) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <h2 className="font-display text-2xl font-bold">Bem-vindo ao TrailBook</h2>
        <p className="mt-2 text-muted-foreground">
          {archivedCount.data && archivedCount.data > 0
            ? "Você não possui motos ativas na garagem. Cadastre uma nova ou reative uma arquivada."
            : "Cadastre sua primeira moto para começar o histórico."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/motorcycles/new">
            <Button className="btn-glow"><Plus className="h-4 w-4" /> Cadastrar moto</Button>
          </Link>
          {(archivedCount.data ?? 0) > 0 && (
            <Link to="/motorcycles" search={{ tab: "archived" } as any}>
              <Button variant="outline"><Archive className="h-4 w-4" /> Ver motos arquivadas ({archivedCount.data})</Button>
            </Link>
          )}
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
        <ActiveMotoCard motos={motos} />

      {/* Pendências do card da moto em foco — nunca mistura motos (v1.6.11). */}
      <DocumentPendenciesCard scopeMotoId={focusMotoId} />

      {!pendencies.isLoading &&
        focusMotoId &&
        (pendencies.data ?? []).filter((p) => p.motorcycle_id === focusMotoId).length === 0 && (
        <section
          aria-label="Sem pendências"
          className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-emerald-100">Tudo em dia por aqui.</div>
            <div className="text-xs text-emerald-200/70">Nenhuma pendência para esta moto.</div>
          </div>
        </section>
      )}

      {focusMotoId && <QuickActions motoId={focusMotoId} />}

      {motos.length > 1 && (
        <section>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-accent/40"
          >
            <span>Suas motos ({motos.length})</span>
            {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showAll && (
            <ul className="mt-3 space-y-2">
              {motos.map((m) => (
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
                      <div className="truncate text-sm font-semibold">{m.nickname || m.model || "Motocicleta"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.brand || "Moto"} · {Number(m.hours_total).toFixed(1)} h · {Number(m.km_total).toFixed(0)} km
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

const QuickActions = memo(function QuickActions({ motoId }: { motoId: string }) {
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
});

// MetricCard removido na Sprint v1.6 — as métricas duplicavam o card da moto ativa.