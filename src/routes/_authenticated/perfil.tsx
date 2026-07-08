import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { User, Settings, Crown, HelpCircle, LogOut, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil — TrailBook" }] }),
  component: PerfilHub,
});

const ITEMS = [
  { to: "/profile", label: "Dados", desc: "Nome, CPF, contato", icon: User },
  { to: "/settings", label: "Configurações", desc: "Preferências e privacidade", icon: Settings },
  { to: "/plans", label: "Plano", desc: "Seu plano e benefícios", icon: Crown },
  { to: "/help", label: "Ajuda", desc: "Central de ajuda e FAQ", icon: HelpCircle },
] as const;

function PerfilHub() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Perfil</h1>
        <p className="text-sm text-muted-foreground">Sua conta, plano e preferências.</p>
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
      <div className="pt-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirm(true)}
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente sair do TrailBook?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={signOut}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
