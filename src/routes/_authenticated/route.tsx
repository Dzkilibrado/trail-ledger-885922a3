import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, LayoutDashboard, Calendar, DollarSign, QrCode, Building2, LogOut, Plus, Menu, X, Crown, ArrowRightLeft, LifeBuoy, Shield, Bell, FolderOpen, Blocks, Wrench, Lock, Mail, MessageSquare, User, Settings, HelpCircle, Compass, UserCircle2, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useModules } from "@/hooks/useModules";
import { ROUTE_TO_MODULE } from "@/lib/modules";
import { ModuleGate } from "@/components/ModuleGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Force profile completion (CPF) before accessing anything else.
    if (location.pathname !== "/complete-profile") {
      const { data: p } = await supabase
        .from("profiles")
        .select("cpf,status,blocked_reason,inactive_reason")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!p?.cpf) throw redirect({ to: "/complete-profile" });
      if (p.status === "blocked" || p.status === "inactive") {
        await supabase.auth.signOut();
        throw redirect({
          to: "/auth",
          search: {
            blocked: p.status,
            reason: (p.status === "blocked" ? p.blocked_reason : p.inactive_reason) ?? "",
          } as any,
        });
      }
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/motorcycles", label: "Minhas Motos", icon: Bike },
  { to: "/documents", label: "Documentos da Moto", icon: FolderOpen },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/certificates", label: "Certificados", icon: QrCode },
  { to: "/tickets", label: "Chamados", icon: LifeBuoy },
  { to: "/messages", label: "Mensagens", icon: Mail },
  { to: "/workshops", label: "Oficinas", icon: Building2 },
  { to: "/financial", label: "Financeiro", icon: DollarSign },
  { to: "/transfers", label: "Transferências", icon: ArrowRightLeft },
] as const;

const ACCOUNT_NAV = [
  { to: "/profile", label: "Perfil", icon: User },
  { to: "/settings", label: "Configurações", icon: Settings },
  { to: "/plans", label: "Plano", icon: Crown },
  { to: "/help", label: "Ajuda", icon: HelpCircle },
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

  useEffect(() => setMobileOpen(false), [pathname]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const askSignOut = () => setSignOutOpen(true);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <SidebarBody pathname={pathname} onSignOut={askSignOut} />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-r border-border bg-sidebar">
            <SidebarBody pathname={pathname} onSignOut={askSignOut} onClose={() => setMobileOpen(false)} />
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
            <Link to="/motorcycles/new">
              <Button size="sm" className="btn-glow"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova</span> moto</Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <RoutedModuleGate pathname={pathname}>
            <Outlet />
          </RoutedModuleGate>
        </main>
      </div>
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" /> Encerrar sessão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente sair do TrailBook?
            </AlertDialogDescription>
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

function RoutedModuleGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const entry = Object.entries(ROUTE_TO_MODULE).find(([path]) => pathname === path || pathname.startsWith(path + "/"));
  if (!entry) return <>{children}</>;
  return <ModuleGate moduleKey={entry[1]}>{children}</ModuleGate>;
}

function SidebarBody({ pathname, onSignOut, onClose }: { pathname: string; onSignOut: () => void; onClose?: () => void }) {
  const { plan } = usePlan();
  const { isAdmin } = useIsAdmin();
  const modulesQ = useModules();
  const moduleByKey = new Map((modulesQ.data ?? []).map((m) => [m.key, m]));
  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground btn-glow">
            <Bike className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold">TrailBook</span>
        </Link>
        {onClose && (
          <button onClick={onClose} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
        )}
      </div>
      <div className="mx-3 mt-3 space-y-1.5">
        <div className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Perfil</span>
          <span className={cn(
            "font-bold uppercase tracking-widest",
            isAdmin ? "text-emerald-400" : "text-foreground/80",
          )}>
            {isAdmin ? "Administrador" : "Usuário"}
          </span>
        </div>
        <Link to="/plans" className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs hover:border-primary/50">
          <span className="text-muted-foreground">Plano</span>
          <span className="font-bold uppercase tracking-widest text-primary">{plan.label}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const modKey = ROUTE_TO_MODULE[item.to];
          const mod = modKey ? moduleByKey.get(modKey) : undefined;
          if (!isAdmin && mod) {
            if (mod.status === "disabled" && mod.hide_when_disabled) return null;
          }
          const disabled = !isAdmin && mod?.status === "disabled";
          const inMaint = !isAdmin && mod?.status === "maintenance";
          if (disabled) {
            return (
              <div key={item.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60 cursor-not-allowed" title="Módulo indisponível">
                <Lock className="h-4 w-4" /> {item.label}
              </div>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {inMaint && <Wrench className="h-3 w-3 text-amber-400" />}
            </Link>
          );
        })}
        {isAdmin && (
          <>
            <div className="mt-4 px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Administração</div>
            {ADMIN_NAV.map((item) => {
              const active = item.to === "/admin" ? pathname === "/admin" : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link key={item.to} to={item.to} onClick={onClose} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}>
                  <item.icon className="h-4 w-4" />{item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/80" onClick={onSignOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
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
    <Link to="/tickets" aria-label="Notificações" className="relative rounded-md p-2 hover:bg-muted">
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