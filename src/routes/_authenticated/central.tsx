import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen, QrCode, ArrowRightLeft, Building2, DollarSign, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/central")({
  head: () => ({ meta: [{ title: "Central — TrailBook" }] }),
  component: CentralHub,
});

const ITEMS = [
  { to: "/documents", label: "Documentos", desc: "Documentos pessoais e da moto", icon: FolderOpen },
  { to: "/certificates", label: "Certificados", desc: "Emitir e consultar certificados", icon: QrCode },
  { to: "/transfers", label: "Compartilhamentos", desc: "Transferências e compartilhamentos de moto", icon: ArrowRightLeft },
  { to: "/workshops", label: "Oficinas", desc: "Seu diretório de oficinas", icon: Building2 },
  { to: "/financial", label: "Financeiro", desc: "Visão consolidada de custos", icon: DollarSign },
] as const;

function CentralHub() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Central</h1>
        <p className="text-sm text-muted-foreground">Documentos, certificados e serviços do seu ecossistema.</p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/50 hover:bg-card"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-foreground">{it.label}</div>
              <div className="truncate text-xs text-muted-foreground">{it.desc}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
