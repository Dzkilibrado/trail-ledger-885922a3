import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Wrench } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/assinaturas")({
  head: () => ({ meta: [{ title: "Gestão de Assinaturas — TrailBook Admin" }] }),
  component: AdminAssinaturasPage,
});

function AdminAssinaturasPage() {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <ShieldCheck className="h-8 w-8 text-primary" />
      </div>
      <div className="mb-2 flex items-center justify-center gap-2">
        <h1 className="font-display text-2xl font-bold">Gestão de Assinaturas</h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-amber-500">
          <Wrench className="h-3 w-3" /> Em Manutenção
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Este módulo administrativo está sendo desenvolvido e estará disponível em breve.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Aqui você poderá gerenciar planos, períodos de trial, pagamentos e acessos de todos os
        usuários da plataforma.
      </p>
    </div>
  );
}
