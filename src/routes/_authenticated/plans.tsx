import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, Wrench as WrenchIcon, Sparkles } from "lucide-react";
import { PLANS, type PlanTier } from "@/lib/plans";
import { usePlan } from "@/hooks/usePlan";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Planos — TrailBook" }] }),
  component: PlansPage,
});

const ICONS: Record<PlanTier, React.ComponentType<{ className?: string }>> = {
  free: Sparkles,
  premium: Crown,
  workshop: WrenchIcon,
};

function PlansPage() {
  const { plan } = usePlan();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Planos TrailBook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o plano ideal para você. A cobrança ainda não está ativa — entre na lista de espera para garantir benefícios de lançamento.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.values(PLANS).map((p) => {
          const Icon = ICONS[p.tier];
          const current = plan.tier === p.tier;
          return (
            <div
              key={p.tier}
              className={`surface-elevated relative flex flex-col gap-5 rounded-2xl p-6 ${p.highlight ? "ring-2 ring-primary" : ""}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Mais popular
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                {current && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    Atual
                  </span>
                )}
              </div>
              <div>
                <div className="font-display text-2xl font-bold">{p.label}</div>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </div>
              <div className="font-display text-3xl font-bold text-primary">{p.priceLabel}</div>
              <ul className="space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                {current ? (
                  <Button disabled className="w-full" variant="outline">Plano atual</Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={p.highlight ? "default" : "outline"}
                    onClick={() => toast.success("Você está na lista de espera deste plano.")}
                  >
                    Entrar na lista de espera
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Os limites do plano atual já estão ativos no app. Quando a cobrança for liberada, contas Free continuam funcionando para 1 moto.
      </p>
    </div>
  );
}