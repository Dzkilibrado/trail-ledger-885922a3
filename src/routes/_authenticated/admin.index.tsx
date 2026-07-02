import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Users, Bike, LifeBuoy, AlertTriangle, Hourglass } from "lucide-react";
import { formatDate } from "@/lib/trailbook";
import { Badge } from "@/components/ui/badge";
import { labelFor, STATUS_TONE, TICKET_STATUSES, PRIORITY_TONE, TICKET_PRIORITIES } from "@/lib/tickets";
import { AccessDenied } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Painel administrativo — TrailBook" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { isAdmin, loading } = useIsAdmin();

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const recentTickets = useQuery({
    queryKey: ["admin", "recent-tickets"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("*").order("last_activity_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const recentAudit = useQuery({
    queryKey: ["admin", "recent-audit"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
  });

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <AccessDenied />;

  const s = stats.data ?? {};
  return (
    <div className="space-y-8">
      <PageHeader title="Painel administrativo" description="Visão geral de usuários, motos e chamados." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Usuários ativos" value={s.users_active} total={s.users_total} tone="text-emerald-400" />
        <Stat icon={Hourglass} label="Pendentes" value={s.users_pending} tone="text-amber-400" />
        <Stat icon={Bike} label="Motos cadastradas" value={s.motorcycles_total} tone="text-primary" />
        <Stat icon={LifeBuoy} label="Chamados abertos" value={s.tickets_open} tone="text-sky-400" />
        <Stat icon={AlertTriangle} label="Chamados críticos" value={s.tickets_critical} tone="text-destructive" />
        <Stat icon={Hourglass} label="Aguardando usuário" value={s.tickets_waiting} tone="text-amber-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold">Últimos chamados</h3>
            <Link to="/admin/tickets" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {(recentTickets.data ?? []).map((t: any) => (
              <Link key={t.id} to="/tickets/$id" params={{ id: t.id }} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:border-primary/50">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-primary">{t.code}</div>
                  <div className="truncate text-sm">{t.title}</div>
                </div>
                <div className="flex gap-1">
                  <Badge className={PRIORITY_TONE[t.priority]}>{labelFor(TICKET_PRIORITIES, t.priority)}</Badge>
                  <Badge className={STATUS_TONE[t.status]}>{labelFor(TICKET_STATUSES, t.status)}</Badge>
                </div>
              </Link>
            ))}
            {!recentTickets.data?.length && <p className="text-sm text-muted-foreground">Nenhum chamado ainda.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 font-display font-semibold">Últimas ações administrativas</h3>
          <div className="space-y-2 text-sm">
            {(recentAudit.data ?? []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{a.table_name} · {a.action}</div>
                  <div className="font-mono text-xs">{a.record_id?.slice(0, 8)}…</div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(a.created_at)}</div>
              </div>
            ))}
            {!recentAudit.data?.length && <p className="text-muted-foreground">Sem eventos recentes.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, total, tone }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-2 font-display text-3xl font-bold">
        {value ?? "—"}{total != null && <span className="ml-1 text-sm text-muted-foreground">/ {total}</span>}
      </div>
    </div>
  );
}