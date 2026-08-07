import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bike,
  LayoutDashboard,
  LogOut,
  Plus,
  Menu,
  X,
  Shield,
  Bell,
  FolderOpen,
  Blocks,
  Wrench,
  Lock,
  Mail,
  MessageSquare,
  User,
  Compass,
  DoorOpen,
  Eye,
  ShieldCheck,
  Home,
  MessageCircle,
  LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useViewAsUser } from "@/hooks/useViewAsUser";
import { useModules } from "@/hooks/useModules";
import { ROUTE_TO_MODULE, HUB_ROUTES, resolveRouteModule } from "@/lib/modules";
import { ModuleGate } from "@/components/ModuleGate";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { TBBottomSheet } from "@/design-system/overlays/TBBottomSheet";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useBottomNav } from "@/hooks/useBottomNav";
import { useActiveMotorcycle } from "@/hooks/useActiveMotorcycle";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Prefer local session (no network round-trip) to avoid intermittent
    // redirects back to /auth on flaky mobile connections. Only when there is
    // truly no session do we bounce the user to sign-in.
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    if (!user) throw redirect({ to: "/auth" });

    // Force profile completion (CPF) before accessing anything else.
    // Tolerate transient network errors — do NOT sign the user out on a
    // simple fetch failure, or the app looks like "login broken".
    //
    // Rotas SEMPRE permitidas para usuário com perfil incompleto:
    // - /complete-profile (wizard)
    // - /help (Central de Ajuda, público)
    // - /tickets, /tickets/new, /tickets/$id (abrir/acompanhar chamado)
    // - /settings (configurações básicas)
    // - /perfil (edição do próprio perfil)
    // Logout é ação de botão, não rota.
    const path = location.pathname;
    const allowedForIncomplete =
      path === "/complete-profile" ||
      path === "/help" ||
      path === "/settings" ||
      path === "/perfil" ||
      path === "/tickets" ||
      path === "/tickets/new" ||
      path.startsWith("/tickets/");
    if (!allowedForIncomplete) {
      try {
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select(
            "cpf,status,blocked_reason,inactive_reason,profile_completed_at,full_name,birth_date,email,phone,whatsapp,whatsapp_same_as_phone,uf,city",
          )
          .eq("id", user.id)
          .maybeSingle();
        if (pErr) {
          // network / RLS glitch: let the app render; the sidebar/profile query
          // will retry and surface a friendlier state.
          return { user };
        }
        if (p && (p.status === "blocked" || p.status === "inactive")) {
          await supabase.auth.signOut();
          throw redirect({
            to: "/auth",
            search: {
              blocked: p.status,
              reason: (p.status === "blocked" ? p.blocked_reason : p.inactive_reason) ?? "",
            } as any,
          });
        }
        if (p && !p.cpf) throw redirect({ to: "/complete-profile" });
        // Gate global: qualquer campo obrigatório faltando → wizard.
        //
        // Fast-path seguro: `profile_completed_at` sozinho NÃO libera o perfil.
        // Sempre validamos localmente os campos essenciais (sem custo, sem RPC).
        // Se algum estiver ausente (campo removido depois, backfill parcial,
        // nova obrigatoriedade), consultamos `profile_completeness` para
        // confirmar antes de bloquear/liberar. Isto evita que o timestamp
        // esconda um perfil incompleto.
        if (p && p.cpf) {
          const essentialsOk = !!(
            p.full_name &&
            p.birth_date &&
            p.email &&
            p.phone &&
            (p.whatsapp || p.whatsapp_same_as_phone) &&
            p.uf &&
            p.city
          );
          if (!p.profile_completed_at || !essentialsOk) {
            const { data: comp } = await supabase.rpc("profile_completeness", { _user: user.id });
            const missing = ((comp ?? {}) as any).missing as string[] | undefined;
            if (Array.isArray(missing) && missing.length > 0) {
              throw redirect({ to: "/complete-profile" });
            }
          }
        }
      } catch (e: any) {
        // Rethrow router redirects; swallow other transient errors.
        if (e && typeof e === "object" && "options" in e && "to" in (e as any)) throw e;
      }
    }
    return { user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/motorcycles", label: "Minhas Motos", icon: Bike },
  { to: "/central", label: "Central", icon: FolderOpen },
  { to: "/comunicacao", label: "Comunicação", icon: MessageCircle },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
  { to: "/admin/users", label: "Usuários", icon: Shield },
  { to: "/admin/tickets", label: "Gestão de Chamados", icon: LifeBuoy },
  { to: "/admin/messages", label: "Central de Mensagens", icon: MessageSquare },
  { to: "/admin/documents", label: "Gestão de Documentos", icon: FolderOpen },
  { to: "/admin/modules", label: "Módulos", icon: Blocks },
] as const;

function AuthedLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const { isAdmin, realIsAdmin, viewingAsUser } = useIsAdmin();
  const viewAs = useViewAsUser();

  useEffect(() => setMobileOpen(false), [pathname]);

  // While viewing as user, block direct URL access to admin routes.
  useEffect(() => {
    if (viewingAsUser && pathname.startsWith("/admin")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [viewingAsUser, pathname, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const askSignOut = () => setSignOutOpen(true);

  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      {viewingAsUser && <HomologChip onExit={() => viewAs.exit()} />}
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <SidebarBody
          pathname={pathname}
          onSignOut={askSignOut}
          isAdmin={isAdmin}
          realIsAdmin={realIsAdmin}
          viewingAsUser={viewingAsUser}
          viewAs={viewAs}
        />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-r border-border bg-sidebar">
            <SidebarBody
              pathname={pathname}
              onSignOut={askSignOut}
              onClose={() => setMobileOpen(false)}
              isAdmin={isAdmin}
              realIsAdmin={realIsAdmin}
              viewingAsUser={viewingAsUser}
              viewAs={viewAs}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <button className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-display text-sm font-semibold text-muted-foreground">
            {NAV.find((n) => pathname.startsWith(n.to))?.label ?? "TrailBook"}
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <MessagesBell />
            <Button asChild size="sm" className="btn-glow">
              <Link to="/motorcycles/new">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova</span> moto
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          <PullToRefresh>
            <RoutedModuleGate pathname={pathname}>
              <Outlet />
            </RoutedModuleGate>
          </PullToRefresh>
        </main>
      </div>
      <BottomNav pathname={pathname} />
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" /> Encerrar sessão
            </AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente sair do TrailBook?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={signOut}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WelcomeTour />
    </div>
  );
}

function RoutedModuleGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  if (HUB_ROUTES.has(pathname)) return <>{children}</>;
  const moduleKey = resolveRouteModule(pathname);
  if (!moduleKey) return <>{children}</>;
  return <ModuleGate moduleKey={moduleKey}>{children}</ModuleGate>;
}

/** Barra de navegação fixa no rodapé — só no mobile. O menu ☰ continua
 * disponível para acesso secundário (config, admin, sair). */
function BottomNav({ pathname }: { pathname: string }) {
  const { items } = useBottomNav();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      {items.map((n) => {
        const active = pathname === n.to || pathname.startsWith(n.to + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  pathname,
  onSignOut,
  onClose,
  isAdmin,
  realIsAdmin,
  viewingAsUser,
  viewAs,
}: {
  pathname: string;
  onSignOut: () => void;
  onClose?: () => void;
  isAdmin: boolean;
  realIsAdmin: boolean;
  viewingAsUser: boolean;
  viewAs: { enter: () => Promise<void>; exit: () => Promise<void> };
}) {
  const { plan } = usePlan();
  const modulesQ = useModules();
  const [enterOpen, setEnterOpen] = useState(false);
  const moduleByKey = new Map((modulesQ.data ?? []).map((m) => [m.key, m]));

  const meQ = useQuery({
    queryKey: ["sidebar", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, email")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const { activeMoto } = useActiveMotorcycle();

  const fullName = meQ.data?.full_name || meQ.data?.email || "Usuário";
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const roleLabel = isAdmin ? "Administrador" : "Usuário";
  const moto = activeMoto;
  const motoLabel = moto
    ? moto.nickname || `${moto.brand ?? ""} ${moto.model ?? ""}`.trim() || "Moto ativa"
    : null;

  function NavLink({
    to,
    label,
    icon: Icon,
    activeStrict,
  }: {
    to: string;
    label: string;
    icon: any;
    activeStrict?: boolean;
  }) {
    const active = activeStrict
      ? pathname === to
      : pathname === to || pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </Link>
    );
  }

  return (
    <>
      {/* Header + logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground btn-glow">
            <Bike className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold">TrailBook</span>
        </Link>
        {onClose && (
          <button onClick={onClose} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* User card */}
      <Link
        to="/profile"
        onClick={onClose}
        className="mx-3 mt-3 block rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3 transition-colors hover:border-primary/50"
      >
        <div className="flex items-center gap-3">
          {meQ.data?.avatar_url ? (
            <img
              src={meQ.data.avatar_url}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-primary/30"
            />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-primary/30">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{fullName}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                  isAdmin
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-foreground/10 text-foreground/70",
                )}
              >
                {roleLabel}
              </span>
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
                {plan.label}
              </span>
            </div>
          </div>
        </div>
        {motoLabel && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-background/40 px-2.5 py-1.5 text-xs">
            <Bike className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Moto ativa
              </div>
              <div className="truncate font-semibold text-foreground">{motoLabel}</div>
            </div>
          </div>
        )}
      </Link>

      {/* View-as-user toggle (admins only) */}
      {realIsAdmin && (
        <div className="mx-3 mt-2">
          {viewingAsUser ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
              onClick={() => viewAs.exit()}
            >
              <ShieldCheck className="h-4 w-4" /> Voltar para Administração
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setEnterOpen(true)}
            >
              <Eye className="h-4 w-4" /> Modo Homologação
            </Button>
          )}
        </div>
      )}

      {/* Scrollable groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Compass className="h-3 w-3" /> Navegação
          </div>
          {NAV.map((item) => {
            const modKey = ROUTE_TO_MODULE[item.to];
            const mod = modKey ? moduleByKey.get(modKey) : undefined;
            if (!isAdmin && mod && mod.status === "disabled" && mod.hide_when_disabled) return null;
            const disabled = !isAdmin && mod?.status === "disabled";
            const inMaint = !isAdmin && mod?.status === "maintenance";
            if (disabled) {
              return (
                <div
                  key={item.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60"
                  title="Módulo indisponível"
                >
                  <Lock className="h-4 w-4 shrink-0" />{" "}
                  <span className="truncate">{item.label}</span>
                </div>
              );
            }
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {inMaint && <Wrench className="h-3 w-3 shrink-0 text-amber-400" />}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="mt-5 space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Shield className="h-3 w-3" /> Administração
            </div>
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                activeStrict={item.to === "/admin"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sessão — fixed bottom */}
      <div className="border-t border-sidebar-border bg-sidebar p-3">
        <div className="flex items-center gap-2 px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <DoorOpen className="h-3 w-3" /> Sessão
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/90 hover:bg-destructive/10 hover:text-destructive"
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>

      <AlertDialog open={enterOpen} onOpenChange={setEnterOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Entrar no Modo Homologação
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block">
                Você continuará autenticado como Administrador na sua própria conta.
              </span>
              <span className="block">
                O TrailBook ocultará as funcionalidades administrativas e exibirá a mesma
                experiência de um usuário comum, usando apenas os dados da sua própria conta —
                nenhum dado de outros usuários será acessado.
              </span>
              <span className="block font-medium">
                Nenhuma permissão real é alterada. A entrada e a saída são registradas na auditoria.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setEnterOpen(false);
                onClose?.();
                await viewAs.enter();
              }}
            >
              Entrar no Modo Homologação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NotificationsBell() {
  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
  const count = data ?? 0;
  return (
    <Link
      to="/notifications"
      aria-label="Notificações"
      className="relative rounded-md p-2 hover:bg-muted"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

function MessagesBell() {
  const { data } = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_unread_count" as any);
      if (error) return 0;
      return Number(data ?? 0);
    },
    refetchInterval: 30_000,
  });
  const count = data ?? 0;
  return (
    <Link to="/messages" aria-label="Mensagens" className="relative rounded-md p-2 hover:bg-muted">
      <Mail className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

function HomologChip({ onExit }: { onExit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        className="fixed right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-amber-500/60 bg-amber-500/95 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-lg backdrop-blur hover:bg-amber-400"
        aria-label="Modo Homologação — abrir detalhes"
      >
        <span aria-hidden>🟡</span>
        <span>Modo Homologação</span>
      </button>
      <TBBottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Modo Homologação ativo"
        description="Você está visualizando o sistema como um usuário comum."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Continuar homologando
            </Button>
            <Button
              className="btn-glow"
              onClick={async () => {
                setOpen(false);
                await onExit();
              }}
            >
              <ShieldCheck className="h-4 w-4" /> Voltar para Administração
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Todos os testes utilizam apenas os dados da sua própria conta — nenhum dado de outros
            usuários é acessado.
          </p>
          <p>
            Nenhuma permissão real é alterada. A entrada e a saída ficam registradas na auditoria.
          </p>
        </div>
      </TBBottomSheet>
    </>
  );
}
