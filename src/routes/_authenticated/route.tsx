import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, LayoutDashboard, Calendar, DollarSign, QrCode, Building2, LogOut, Plus, Menu, X, Crown, ArrowRightLeft, LifeBuoy, Shield, Bell, FolderOpen, Blocks, Wrench, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useModules } from "@/hooks/useModules";
import { ROUTE_TO_MODULE } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/motorcycles", label: "Motos", icon: Bike },
  { to: "/documents", label: "Documentos da Moto", icon: FolderOpen },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/workshops", label: "Oficinas", icon: Building2 },
  { to: "/financial", label: "Financeiro", icon: DollarSign },
  { to: "/certificates", label: "Certificados", icon: QrCode },
  { to: "/transfers", label: "Transferências", icon: ArrowRightLeft },
  { to: "/tickets", label: "Chamados", icon: LifeBuoy },
  { to: "/plans", label: "Planos", icon: Crown },
] as const;

const ADMIN_NAV = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard },
  { to: "/admin/users", label: "Usuários", icon: Shield },
  { to: "/admin/tickets", label: "Chamados", icon: LifeBuoy },
  { to: "/admin/documents", label: "Documentos", icon: FolderOpen },
  { to: "/admin/modules", label: "Módulos", icon: Blocks },
] as const;

function AuthedLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <SidebarBody pathname={pathname} onSignOut={signOut} />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-border bg-sidebar">
            <SidebarBody pathname={pathname} onSignOut={signOut} onClose={() => setMobileOpen(false)} />
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
            <Link to="/motorcycles/new">
              <Button size="sm" className="btn-glow"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova</span> moto</Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
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
      <Link to="/plans" className="mx-3 mt-3 flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs hover:border-primary/50">
        <span className="text-muted-foreground">Plano</span>
        <span className="font-bold uppercase tracking-widest text-primary">{plan.label}</span>
      </Link>
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
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link key={item.to} to={item.to} className={cn(
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