import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Pencil,
  Settings,
  Crown,
  KeyRound,
  AlertOctagon,
  ShieldCheck,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  UserRound,
  LayoutGrid,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/usePlan";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/perfil/")({
  head: () => ({ meta: [{ title: "Minha Conta — TrailBook" }] }),
  component: AccountCenter,
});

const APP_VERSION = "1.2.1";

type Row = { to: string; label: string; icon: any; hint?: string; external?: boolean };

const PREFERENCES: Row[] = [
  {
    to: "/perfil/atalhos",
    label: "Personalizar atalhos",
    icon: LayoutGrid,
    hint: "Escolha o que aparece na tela inicial",
  },
  {
    to: "/perfil/menu-inferior",
    label: "Personalizar menu inferior",
    icon: LayoutGrid,
    hint: "Escolha os itens da barra de navegação do celular",
  },
  { to: "/settings", label: "Configurações", icon: Settings, hint: "Tema e preferências gerais" },
  { to: "/plans", label: "Plano atual", icon: Crown, hint: "Seu plano e benefícios" },
];

const SECURITY: Row[] = [
  { to: "/reset-password", label: "Alterar senha", icon: KeyRound },
  {
    to: "/perfil/conta",
    label: "Gerenciar conta",
    icon: AlertOctagon,
    hint: "Redefinir ou excluir sua conta",
  },
];

const SUPPORT: Row[] = [
  {
    to: "/faq",
    label: "Perguntas frequentes",
    icon: HelpCircle,
    hint: "Dúvidas comuns sobre o TrailBook",
  },
];

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {title}
    </div>
  );
}

function RowLink({ to, label, icon: Icon, hint }: Row) {
  return (
    <Link
      to={to}
      className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-card active:bg-card"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function AccountCenter() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { plan } = usePlan();
  const { isAdmin } = useIsAdmin();
  const [confirm, setConfirm] = useState(false);

  const meQ = useQuery({
    queryKey: ["account-center", "me"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", s.session.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const p = meQ.data;
  const fullName = p?.full_name || p?.email || "Minha conta";
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-8">
      {/* Minha Conta — cartão de identidade */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-3">
          {p?.avatar_url ? (
            <img
              src={p.avatar_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-primary/30"
            />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/15 text-lg font-bold text-primary ring-2 ring-primary/30">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold text-foreground">
              {fullName}
            </div>
            <div className="truncate text-xs text-muted-foreground">{p?.email ?? ""}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Crown className="mr-1 inline h-3 w-3" /> {plan.label}
              </span>
              {isAdmin && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  Administrador
                </span>
              )}
            </div>
          </div>
          <Link to="/profile" aria-label="Editar perfil">
            <Button variant="outline" size="sm" className="shrink-0">
              <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Editar</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* Sair — em destaque logo abaixo do cartão, sem rolagem */}
      <Button
        variant="outline"
        className="h-12 w-full justify-center gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirm(true)}
      >
        <LogOut className="h-4 w-4" /> Sair do TrailBook
      </Button>

      {/* Preferências */}
      <section>
        <SectionHeader icon={Settings} title="Preferências" />
        <div className="space-y-2">
          {PREFERENCES.map((r) => (
            <RowLink key={r.label} {...r} />
          ))}
        </div>
      </section>

      {/* Segurança */}
      <section>
        <SectionHeader icon={ShieldCheck} title="Segurança" />
        <div className="space-y-2">
          {SECURITY.map((r) => (
            <RowLink key={r.label} {...r} />
          ))}
        </div>
      </section>

      {/* Suporte */}
      <section>
        <SectionHeader icon={HelpCircle} title="Suporte" />
        <div className="space-y-2">
          {SUPPORT.map((r) => (
            <RowLink key={r.label} {...r} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-dashed border-border/60 bg-card/30 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Política de Privacidade · Termos de Uso</span>
          </span>
          <span className="shrink-0 font-mono">v{APP_VERSION}</span>
        </div>
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" /> Encerrar sessão
            </AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente sair do TrailBook?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={signOut}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* silenciar o import não usado — reservado para futuras seções */}
      <span className="sr-only" aria-hidden>
        <UserRound />
      </span>
    </div>
  );
}
