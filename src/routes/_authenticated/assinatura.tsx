import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({ meta: [{ title: "Minha Assinatura — TrailBook" }] }),
  component: AssinaturaPage,
});

function AssinaturaPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <CreditCard className="h-8 w-8 text-primary" />
      </div>
      <div className="mb-2 flex items-center justify-center gap-2">
        <h1 className="font-display text-2xl font-bold">Minha Assinatura</h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-amber-500">
          <Wrench className="h-3 w-3" /> Em Manutenção
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Esta área está sendo preparada e estará disponível em breve.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Aqui você poderá gerenciar seu plano, acompanhar o período de acesso e visualizar o
        histórico de pagamentos.
      </p>
    </div>
  );
}
